import { db } from '@/shared/database';
import { Try } from '@/shared/utils/Try';

class AnalyticsService {
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
  async getMostActiveUsers(limit: number = 10) {
    return Try.execute(async () => {
      const result = await db.$queryRaw<
        Array<{
          userId: number;
          firstName: string | null;
          lastName: string | null;
          email: string;
          contributions: bigint;
        }>
      >`
        SELECT 
          u.id as userId,
          u.first_name as firstName,
          u.last_name as lastName,
          u.email,
          COUNT(c.id) as contributions
        FROM users u
        LEFT JOIN contributions c ON u.id = c.user_id
        WHERE u.is_active = 1
        GROUP BY u.id, u.first_name, u.last_name, u.email
        HAVING contributions > 0
        ORDER BY contributions DESC
        LIMIT ${limit}
      `;

      return result.map(row => ({
        userId: row.userId,
        username: row.firstName && row.lastName 
          ? `${row.firstName} ${row.lastName}` 
          : row.email.split('@')[0],
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        contributions: Number(row.contributions),
      }));
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
  async getFacultyContributionDistribution(academicYearId?: number) {
    return Try.execute(async () => {
      let yearId = academicYearId;
      
      if (!yearId) {
        // Get current academic year
        const currentYear = await db.academicYear.findFirst({
          where: { isCurrent: true },
        });
        yearId = currentYear?.id;
      }

      let result;
      if (yearId) {
        result = await db.$queryRaw<
          Array<{
            facultyCode: string;
            facultyName: string;
            contributions: bigint;
          }>
        >`
          SELECT 
            f.faculty_code as facultyCode,
            f.faculty_name as facultyName,
            COUNT(c.id) as contributions
          FROM faculties f
          LEFT JOIN contributions c ON f.id = c.faculty_id AND c.academic_year_id = ${yearId}
          WHERE f.is_active = 1
          GROUP BY f.id, f.faculty_code, f.faculty_name
          ORDER BY f.faculty_name ASC
        `;
      } else {
        result = await db.$queryRaw<
          Array<{
            facultyCode: string;
            facultyName: string;
            contributions: bigint;
          }>
        >`
          SELECT 
            f.faculty_code as facultyCode,
            f.faculty_name as facultyName,
            COUNT(c.id) as contributions
          FROM faculties f
          LEFT JOIN contributions c ON f.id = c.faculty_id
          WHERE f.is_active = 1
          GROUP BY f.id, f.faculty_code, f.faculty_name
          ORDER BY f.faculty_name ASC
        `;
      }

      return result.map(row => ({
        facultyCode: row.facultyCode,
        facultyName: row.facultyName,
        contributions: Number(row.contributions),
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
