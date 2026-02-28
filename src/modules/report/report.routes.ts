import { Router } from 'express';
import reportController from './report.controller';
import { authorize } from '@/middleware/authorize';
import { requireFacultyIfRoleNeedsIt } from '@/middleware/facultyScope';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.get(
  '/faculty/:facultyId/statistics',
  authenticate,
  authorize('admin', 'manager', 'coordinator'),
  requireFacultyIfRoleNeedsIt,
  reportController.getFacultyStatistics
);
router.get(
  '/faculty/:facultyId/exceptions',
  authenticate,
  authorize('admin', 'manager', 'coordinator'),
  requireFacultyIfRoleNeedsIt,
  reportController.getFacultyExceptions
);

export default router;
