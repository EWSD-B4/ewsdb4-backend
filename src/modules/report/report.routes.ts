import { Router } from 'express';
import reportController from './report.controller';
import { authorize } from '@/middleware/authorize';
import { requireFacultyIfRoleNeedsIt } from '@/middleware/facultyScope';
import { authenticate } from '@/middleware/auth';
import { ROLES } from '@/constants/roles';

const router = Router();

router.get(
  '/faculty/:facultyId/statistics',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  reportController.getFacultyStatistics
);
router.get(
  '/faculty/:facultyId/exceptions',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  reportController.getFacultyExceptions
);

export default router;
