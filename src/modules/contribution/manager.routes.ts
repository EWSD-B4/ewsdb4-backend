import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { authenticate } from '@/middleware/auth';
import contributionController from './contribution.controller';
import { ROLES } from '@/constants/roles';

const router = Router();

router.get(
  '/selected/download',
  authenticate,
  authorize(ROLES.MANAGER),
  contributionController.downloadSelectedAsZip
);

router.get(
  '/selected',
  authenticate,
  authorize(ROLES.MANAGER),
  contributionController.listAllSelected
);

router.get(
  '/selected/:id',
  authenticate,
  authorize(ROLES.MANAGER),
  contributionController.getSelectedContribution
);

router.get(
  '/reports/statistics',
  authenticate,
  authorize(ROLES.MANAGER),
  contributionController.getStatistics
);

router.get(
  '/reports/faculty-year',
  authenticate,
  authorize(ROLES.MANAGER),
  contributionController.getFacultyYearReport
);

router.get(
  '/reports/exceptions',
  authenticate,
  authorize(ROLES.MANAGER),
  contributionController.getExceptionReport
);

export default router;
