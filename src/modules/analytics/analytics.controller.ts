import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import analyticsService from './analytics.service';
import { successResponse } from '@/utils/response';

class AnalyticsController {
  private resolvePeriodFilter(rawPeriod: unknown) {
    const value = String(rawPeriod || 'all').toLowerCase();
    const allowed = ['all', 'this_week', 'this_month', 'this_semester', 'last_semester'];
    return allowed.includes(value) ? (value as 'all' | 'this_week' | 'this_month' | 'this_semester' | 'last_semester') : 'all';
  }

  /**
   * Get most viewed pages
   * GET /api/v1/analytics/most-viewed-pages
   */
  getMostViewedPages = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(String(req.query.limit || '10'), 10);
    const pages = await analyticsService.getMostViewedPages(limit);

    res.json(
      successResponse(pages, req.requestId || 'unknown', {
        message: 'Most viewed pages retrieved',
      })
    );
  });

  /**
   * Get most active users
   * GET /api/v1/analytics/most-active-users
   */
  getMostActiveUsers = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(String(req.query.limit || '10'), 10);
    const academicYearId = req.query.academicYearId
      ? parseInt(String(req.query.academicYearId), 10)
      : undefined;
    const period = this.resolvePeriodFilter(req.query.period);
    const users = await analyticsService.getMostActiveUsers(limit, period, academicYearId);

    res.json(
      successResponse(users, req.requestId || 'unknown', {
        message: 'Most active users retrieved',
      })
    );
  });

  /**
   * Get browser usage statistics
   * GET /api/v1/analytics/browser-usage
   */
  getBrowserUsage = asyncHandler(async (req: Request, res: Response) => {
    const browserStats = await analyticsService.getBrowserUsage();

    res.json(
      successResponse(browserStats, req.requestId || 'unknown', {
        message: 'Browser usage statistics retrieved',
      })
    );
  });

  /**
   * Get faculty contribution distribution
   * GET /api/v1/analytics/faculty-distribution
   */
  getFacultyDistribution = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(String(req.query.academicYearId), 10)
      : undefined;
    const period = this.resolvePeriodFilter(req.query.period);

    const distribution = await analyticsService.getFacultyContributionDistribution(
      academicYearId,
      period
    );

    res.json(
      successResponse(distribution, req.requestId || 'unknown', {
        message: 'Faculty contribution distribution retrieved',
      })
    );
  });

  /**
   * Get system statistics
   * GET /api/v1/analytics/system-stats
   */
  getSystemStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await analyticsService.getSystemStats();

    res.json(
      successResponse(stats, req.requestId || 'unknown', {
        message: 'System statistics retrieved',
      })
    );
  });

  /**
   * Get all dashboard data in one call
   * GET /api/v1/analytics/dashboard
   */
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(String(req.query.academicYearId), 10)
      : undefined;
    const period = this.resolvePeriodFilter(req.query.period);
    const [mostViewedPages, mostActiveUsers, browserUsage, facultyDistribution, systemStats] =
      await Promise.all([
        analyticsService.getMostViewedPages(5),
        analyticsService.getMostActiveUsers(5, period, academicYearId),
        analyticsService.getBrowserUsage(),
        analyticsService.getFacultyContributionDistribution(academicYearId, period),
        analyticsService.getSystemStats(),
      ]);

    res.json(
      successResponse(
        {
          mostViewedPages,
          mostActiveUsers,
          browserUsage,
          facultyDistribution,
          systemStats,
        },
        req.requestId || 'unknown',
        {
          message: 'Dashboard data retrieved',
        }
      )
    );
  });
}

export default new AnalyticsController();
