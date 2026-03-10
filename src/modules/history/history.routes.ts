import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import historyController from './history.controller';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'MANAGER'), historyController.getHistory);

router.get(
  '/contributions/:contributionId',
  authenticate,
  historyController.getContributionHistory
);

router.get('/users/:userId', authenticate, historyController.getUserActivityHistory);

router.get('/audit-trail', authenticate, authorize('ADMIN'), historyController.getAuditTrail);

export default router;
