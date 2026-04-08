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

router.get(
  '/contributions-by-faculty',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  reportController.getContributionsByFaculty
);

router.get(
  '/contributors-by-faculty',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  reportController.getContributorsByFaculty
);

router.get(
  '/contribution-percentages',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER),
  reportController.getContributionPercentages
);

router.get(
  '/exceptions/no-comment',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.COORDINATOR),
  reportController.getContributionsWithoutComments
);

router.get(
  '/exceptions/overdue',
  authenticate,
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.COORDINATOR),
  reportController.getOverdueContributions
);

router.get(
  '/system-usage',
  authenticate,
  authorize(ROLES.ADMIN),
  reportController.getSystemUsage
);

export default router;
