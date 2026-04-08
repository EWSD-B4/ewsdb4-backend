import { db as prisma } from '@/shared/database';

class ReportService {
  async getFacultyStatistics(facultyId: number, academicYearId: number) {
    const total = await prisma.contribution.count({
      where: { facultyId, academicYearId },
    });

    const selected = await prisma.contribution.count({
      where: { facultyId, academicYearId, status: 'selected' },
    });

    const distinctContributors = await prisma.contribution.findMany({
      where: { facultyId, academicYearId },
      distinct: ['userId'],
      select: { userId: true },
    });

    return {
      totalContributions: total,
      selectedContributions: selected,
      distinctContributors: distinctContributors.length,
    };
  }

  async getFacultyExceptions(facultyId: number, academicYearId: number) {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [missingComment, overdue] = await Promise.all([
      prisma.contribution.findMany({
        where: {
          facultyId,
          academicYearId,
          status: { in: ['submitted', 'under_review'] },
          comments: { none: {} },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { submittedAt: 'asc' },
      }),
      prisma.contribution.findMany({
        where: {
          facultyId,
          academicYearId,
          status: { in: ['submitted', 'under_review'] },
          submittedAt: { lte: fourteenDaysAgo },
          comments: { none: {} },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { submittedAt: 'asc' },
      }),
    ]);

    return {
      missingComment,
      overdue,
      totalMissingComment: missingComment.length,
      totalOverdue: overdue.length,
    };
  }
}

export default new ReportService();
