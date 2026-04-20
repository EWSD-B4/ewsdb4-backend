import { db } from '@/shared/database';
import { Try } from '@/shared/utils/Try';
import {
  ContributionsByFacultyReport,
  ContributorsByFacultyReport,
  ContributionPercentageReport,
  ExceptionReport,
  SystemUsageReport,
  ReportQuery,
} from './report.types';

class ReportFullService {
  async getContributionsByFaculty(
    query: ReportQuery
  ): Promise<ContributionsByFacultyReport[]> {
    return Try.execute(async () => {
      const where: any = {};
      if (query.academicYearId) where.academicYearId = query.academicYearId;
      if (query.facultyId) where.facultyId = query.facultyId;

      const contributions = await db.contribution.groupBy({
        by: ['facultyId', 'academicYearId'],
        where,
        _count: { id: true },
      });

      const results = await Promise.all(
        contributions.map(async (item) => {
          const faculty = await db.faculty.findUnique({
            where: { id: item.facultyId },
          });
          const academicYear = await db.academicYear.findUnique({
            where: { id: item.academicYearId },
          });

          return {
            facultyId: item.facultyId,
            facultyName: faculty?.facultyName || 'Unknown',
            facultyCode: faculty?.facultyCode || 'UNK',
            academicYearId: item.academicYearId,
            academicYearName: academicYear?.yearName || 'Unknown',
            contributionCount: item._count.id,
          };
        })
      );

      return results.sort((a, b) => b.contributionCount - a.contributionCount);
    }).orElseThrow('Error generating contributions by faculty report');
  }

  async getContributorsByFaculty(query: ReportQuery): Promise<ContributorsByFacultyReport[]> {
    return Try.execute(async () => {
      const where: any = {};
      if (query.academicYearId) where.academicYearId = query.academicYearId;
      if (query.facultyId) where.facultyId = query.facultyId;

      const contributions = await db.contribution.findMany({
        where,
        select: {
          facultyId: true,
          academicYearId: true,
          userId: true,
        },
      });

      const grouped = contributions.reduce((acc, item) => {
        const key = `${item.facultyId}-${item.academicYearId}`;
        if (!acc[key]) {
          acc[key] = {
            facultyId: item.facultyId,
            academicYearId: item.academicYearId,
            users: new Set<number>(),
          };
        }
        acc[key].users.add(item.userId);
        return acc;
      }, {} as Record<string, { facultyId: number; academicYearId: number; users: Set<number> }>);

      const results = await Promise.all(
        Object.values(grouped).map(async (item) => {
          const faculty = await db.faculty.findUnique({
            where: { id: item.facultyId },
          });
          const academicYear = await db.academicYear.findUnique({
            where: { id: item.academicYearId },
          });

          return {
            facultyId: item.facultyId,
            facultyName: faculty?.facultyName || 'Unknown',
            facultyCode: faculty?.facultyCode || 'UNK',
            academicYearId: item.academicYearId,
            academicYearName: academicYear?.yearName || 'Unknown',
            contributorCount: item.users.size,
          };
        })
      );

      return results.sort((a, b) => b.contributorCount - a.contributorCount);
    }).orElseThrow('Error generating contributors by faculty report');
  }

  async getContributionPercentages(
    academicYearId: number
  ): Promise<ContributionPercentageReport[]> {
    return Try.execute(async () => {
      const total = await db.contribution.count({
        where: { academicYearId },
      });

      if (total === 0) {
        return [];
      }

      const contributions = await db.contribution.groupBy({
        by: ['facultyId'],
        where: { academicYearId },
        _count: { id: true },
      });

      const results = await Promise.all(
        contributions.map(async (item) => {
          const faculty = await db.faculty.findUnique({
            where: { id: item.facultyId },
          });
          const academicYear = await db.academicYear.findUnique({
            where: { id: academicYearId },
          });

          return {
            facultyId: item.facultyId,
            facultyName: faculty?.facultyName || 'Unknown',
            facultyCode: faculty?.facultyCode || 'UNK',
            academicYearId,
            academicYearName: academicYear?.yearName || 'Unknown',
            contributionCount: item._count.id,
            percentage: Math.round((item._count.id / total) * 100 * 100) / 100,
          };
        })
      );

      return results.sort((a, b) => b.percentage - a.percentage);
    }).orElseThrow('Error generating contribution percentage report');
  }

  async getContributionsWithoutComments(facultyId?: number): Promise<ExceptionReport[]> {
    return Try.execute(async () => {
      const where: any = {
        status: 'submitted',
      };

      if (facultyId) {
        where.facultyId = facultyId;
      }

      const contributions = await db.contribution.findMany({
        where,
        include: {
          _count: { select: { comments: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          faculty: { select: { id: true, facultyName: true } },
        },
      });

      return contributions
        .filter((c) => c._count.comments === 0)
        .map((c) => ({
          id: c.id,
          title: c.title,
          submittedAt: c.submittedAt ? c.submittedAt.toISOString() : null,
          daysSinceSubmission: c.submittedAt
            ? Math.floor((Date.now() - c.submittedAt.getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          user: c.user,
          faculty: c.faculty,
        }))
        .sort((a, b) => b.daysSinceSubmission - a.daysSinceSubmission);
    }).orElseThrow('Error generating contributions without comments report');
  }

  async getOverdueContributions(facultyId?: number): Promise<ExceptionReport[]> {
    return Try.execute(async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const where: any = {
        status: 'submitted',
        submittedAt: { lt: fourteenDaysAgo },
      };

      if (facultyId) {
        where.facultyId = facultyId;
      }

      const contributions = await db.contribution.findMany({
        where,
        include: {
          _count: { select: { comments: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          faculty: { select: { id: true, facultyName: true } },
        },
      });

      const coordinators = await db.user.findMany({
        where: {
          role: { roleCode: 'COORDINATOR' },
          ...(facultyId ? { facultyId } : {}),
        },
        select: { id: true, firstName: true, lastName: true, email: true, facultyId: true },
      });

      return contributions
        .filter((c) => c._count.comments === 0)
        .map((c) => {
          const coordinator = coordinators.find((coord) => coord.facultyId === c.facultyId);
          return {
            id: c.id,
            title: c.title,
            submittedAt: c.submittedAt ? c.submittedAt.toISOString() : null,
            daysSinceSubmission: c.submittedAt
              ? Math.floor((Date.now() - c.submittedAt.getTime()) / (1000 * 60 * 60 * 24))
              : 0,
            user: c.user,
            faculty: c.faculty,
            coordinator: coordinator
              ? {
                  id: coordinator.id,
                  firstName: coordinator.firstName,
                  lastName: coordinator.lastName,
                  email: coordinator.email,
                }
              : undefined,
          };
        })
        .sort((a, b) => b.daysSinceSubmission - a.daysSinceSubmission);
    }).orElseThrow('Error generating overdue contributions report');
  }

  async getSystemUsageReport(): Promise<SystemUsageReport> {
    return Try.execute(async () => {
      // Get active academic year
      const activeAcademicYear = await db.academicYear.findFirst({
        where: { isActive: true, isCurrent: true },
      });

      const academicYearId = activeAcademicYear?.id;

      const [
        totalUsers,
        totalContributions,
        totalComments,
        totalSelectedContributions,
        activeAcademicYears,
        activeFaculties,
        contributionsByStatus,
      ] = await Promise.all([
        db.user.count({ where: { isActive: true } }),
        db.contribution.count({ where: academicYearId ? { academicYearId } : {} }),
        db.comment.count(),
        db.contribution.count({ where: { status: 'selected', ...(academicYearId ? { academicYearId } : {}) } }),
        db.academicYear.count({ where: { isActive: true } }),
        db.faculty.count({ where: { isActive: true } }),
        db.contribution.groupBy({
          by: ['status'],
          _count: { id: true },
          where: academicYearId ? { academicYearId } : {},
        }),
      ]);

      return {
        totalUsers,
        totalContributions,
        totalComments,
        totalSelectedContributions,
        activeAcademicYears,
        activeFaculties,
        contributionsByStatus: contributionsByStatus.map((item) => ({
          status: item.status,
          count: item._count.id,
        })),
      };
    }).orElseThrow('Error generating system usage report');
  }

  async getFacultyStatistics(facultyId: number, academicYearId?: number) {
    return Try.execute(async () => {
      const where: any = { facultyId };
      if (academicYearId) where.academicYearId = academicYearId;

      const [total, selected, submitted, distinctContributors] = await Promise.all([
        db.contribution.count({ where }),
        db.contribution.count({ where: { ...where, status: 'selected' } }),
        db.contribution.count({ where: { ...where, status: 'submitted' } }),
        db.contribution.findMany({
          where,
          distinct: ['userId'],
          select: { userId: true },
        }),
      ]);

      return {
        totalContributions: total,
        selectedContributions: selected,
        submittedContributions: submitted,
        distinctContributors: distinctContributors.length,
      };
    }).orElseThrow('Error generating faculty statistics');
  }
}

export default new ReportFullService();
