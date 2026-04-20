import { db } from '@/shared/database';
import { Try } from '@/shared/utils/Try';

type PeriodFilter = 'all' | 'this_week' | 'this_month' | 'this_semester' | 'last_semester';

class AnalyticsService {
  private async resolvePeriodRange(period: PeriodFilter, academicYearId?: number): Promise<{
    gte?: Date;
    lt?: Date;
    academicYearId?: number;
  }> {
    if (period === 'all') {
      return academicYearId ? { academicYearId } : {};
    }

    const now = new Date();

    if (period === 'this_week') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { gte: start, lt: end, academicYearId };
    }

    if (period === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { gte: start, lt: end, academicYearId };
    }

    let yearId = academicYearId;
    let academicYear = yearId
      ? await db.academicYear.findUnique({ where: { id: yearId } })
      : await db.academicYear.findFirst({ where: { isCurrent: true, isActive: true } });

    if (!academicYear) {
      return academicYearId ? { academicYearId } : {};
    }

    yearId = academicYear.id;
    const start = new Date(academicYear.startDate);
    const end = new Date(academicYear.endDate);
    const midpoint = new Date((start.getTime() + end.getTime()) / 2);

    if (period === 'this_semester') {
      if (now < midpoint) {
        return { gte: start, lt: midpoint, academicYearId: yearId };
      }
      return { gte: midpoint, lt: end, academicYearId: yearId };
    }

    if (now >= midpoint) {
      return { gte: start, lt: midpoint, academicYearId: yearId };
    }

    const previousAcademicYear = await db.academicYear.findFirst({
      where: { startDate: { lt: academicYear.startDate }, isActive: true },
      orderBy: { startDate: 'desc' },
    });

    if (!previousAcademicYear) {
      return { academicYearId: yearId };
    }

    const previousMidpoint = new Date(
      (previousAcademicYear.startDate.getTime() + previousAcademicYear.endDate.getTime()) / 2
    );

    return {
      gte: previousMidpoint,
      lt: previousAcademicYear.endDate,
      academicYearId: previousAcademicYear.id,
    };
  }

  /**
   * Get most viewed pages
   */
  async getMostViewedPages(limit: number = 10) {
    return Try.execute(async () => {
      const result = await db.$queryRaw<Array<{ page: string; views: bigint }>>`
        SELECT page, COUNT(*) as views
        FROM user_activities
        WHERE action = 'view'
        GROUP BY page
        ORDER BY views DESC
        LIMIT ${limit}
      `;

      return result.map(row => ({
        page: row.page,
        views: Number(row.views),
      }));
    }).orElseThrow('Error fetching most viewed pages');
  }

  /**
   * Get most active users with contribution counts
   */
  async getMostActiveUsers(limit: number = 10, period: PeriodFilter = 'all', academicYearId?: number) {
    return Try.execute(async () => {
      const range = await this.resolvePeriodRange(period, academicYearId);
      const grouped = await db.contribution.groupBy({
        by: ['userId'],
        _count: { id: true },
        where: {
          academicYearId: range.academicYearId,
          createdAt: range.gte || range.lt ? { gte: range.gte, lt: range.lt } : undefined,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: limit,
      });

      const users = await db.user.findMany({
        where: {
          id: { in: grouped.map((item) => item.userId) },
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      return grouped
        .map((item) => {
          const user = users.find((candidate) => candidate.id === item.userId);
          if (!user) {
            return null;
          }

          return {
            userId: user.id,
            username:
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.email.split('@')[0],
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            contributions: item._count.id,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
    }).orElseThrow('Error fetching most active users');
  }

  /**
   * Get browser usage statistics
   */
  async getBrowserUsage() {
    return Try.execute(async () => {
      const activities = await db.$queryRaw<Array<{ userAgent: string | null }>>`
        SELECT user_agent as userAgent
        FROM user_activities
        WHERE user_agent IS NOT NULL
      `;

      const browserCounts: Record<string, number> = {
        Chrome: 0,
        Firefox: 0,
        Safari: 0,
        Edge: 0,
        Other: 0,
      };

      activities.forEach((activity: { userAgent: string | null }) => {
        const ua = activity.userAgent || '';
        if (ua.includes('Chrome') && !ua.includes('Edge')) {
          browserCounts.Chrome++;
        } else if (ua.includes('Firefox')) {
          browserCounts.Firefox++;
        } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
          browserCounts.Safari++;
        } else if (ua.includes('Edge')) {
          browserCounts.Edge++;
        } else {
          browserCounts.Other++;
        }
      });

      const total = Object.values(browserCounts).reduce((sum, count) => sum + count, 0);

      return Object.entries(browserCounts).map(([browser, count]) => ({
        browser,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
    }).orElseThrow('Error fetching browser usage');
  }

  /**
   * Get faculty contribution distribution for current academic year
   */
  async getFacultyContributionDistribution(
    academicYearId?: number,
    period: PeriodFilter = 'all'
  ) {
    return Try.execute(async () => {
      const range = await this.resolvePeriodRange(period, academicYearId);
      const faculties = await db.faculty.findMany({
        where: { isActive: true },
        orderBy: { facultyName: 'asc' },
        select: {
          id: true,
          facultyCode: true,
          facultyName: true,
        },
      });

      const grouped = await db.contribution.groupBy({
        by: ['facultyId'],
        _count: { id: true },
        where: {
          academicYearId: range.academicYearId,
          createdAt: range.gte || range.lt ? { gte: range.gte, lt: range.lt } : undefined,
        },
      });

      return faculties.map((faculty) => ({
        facultyCode: faculty.facultyCode,
        facultyName: faculty.facultyName,
        contributions:
          grouped.find((item) => item.facultyId === faculty.id)?._count.id ?? 0,
      }));
    }).orElseThrow('Error fetching faculty contribution distribution');
  }

  /**
   * Get overall system statistics
   */
  async getSystemStats() {
    return Try.execute(async () => {
      const [totalUsers, totalContributions, totalActivitiesResult, activeUsers] = await Promise.all([
        db.user.count({ where: { isActive: true } }),
        db.contribution.count(),
        db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM user_activities`,
        db.user.count({
          where: {
            isActive: true,
            lastLogin: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        }),
      ]);
      
      const totalActivities = Number(totalActivitiesResult[0]?.count || 0);

      return {
        totalUsers,
        totalContributions,
        totalActivities,
        activeUsers,
      };
    }).orElseThrow('Error fetching system stats');
  }
}

export default new AnalyticsService();
