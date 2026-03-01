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

    const missingComment = await prisma.contribution.findMany({
      where: {
        facultyId,
        academicYearId,
      },
      select: { id: true, submittedAt: true, status: true },
    });

    const overdue = await prisma.contribution.findMany({
      where: {
        facultyId,
        academicYearId,
        submittedAt: { lte: fourteenDaysAgo },
      },
      select: { id: true, submittedAt: true, status: true },
    });

    return { missingComment, overdue };
  }
}

export default new ReportService();
