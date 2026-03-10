import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import historyService from './history.service';
import { successResponse } from '@/utils/response';

class HistoryController {
  getHistory = asyncHandler(async (req: Request, res: Response) => {
    const query = {
      contributionId: req.query.contributionId
        ? parseInt(String(req.query.contributionId), 10)
        : undefined,
      userId: req.query.userId ? parseInt(String(req.query.userId), 10) : undefined,
      action: req.query.action ? String(req.query.action) : undefined,
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : undefined,
    };

    const result = await historyService.getHistory(query);

    return res.json(
      successResponse(result, req.requestId || 'unknown', {
        message: 'History retrieved successfully',
      })
    );
  });

  getContributionHistory = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.contributionId), 10);
    const history = await historyService.getContributionHistory(contributionId);

    return res.json(
      successResponse({ history, total: history.length }, req.requestId || 'unknown', {
        message: 'Contribution history retrieved successfully',
      })
    );
  });

  getUserActivityHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(String(req.params.userId), 10);
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const history = await historyService.getUserActivityHistory(userId, limit);

    return res.json(
      successResponse({ history, total: history.length }, req.requestId || 'unknown', {
        message: 'User activity history retrieved successfully',
      })
    );
  });

  getAuditTrail = asyncHandler(async (req: Request, res: Response) => {
    const startDate = new Date(String(req.query.startDate));
    const endDate = new Date(String(req.query.endDate));

    const history = await historyService.getAuditTrail(startDate, endDate);

    return res.json(
      successResponse({ history, total: history.length }, req.requestId || 'unknown', {
        message: 'Audit trail retrieved successfully',
      })
    );
  });
}

export default new HistoryController();
