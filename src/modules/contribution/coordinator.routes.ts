import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { authenticate } from '@/middleware/auth';
import { requireFacultyIfRoleNeedsIt } from '@/middleware/facultyScope';
import contributionController from './contribution.controller';
import { ROLES } from '@/constants/roles';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(ROLES.MANAGER, ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.listCoordinator
);
router.get(
  '/:id',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.getCoordinator
);
router.put(
  '/:id/status',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.updateStatus
);

router.post(
  '/:id/select',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.selectContribution
);

router.post(
  '/:id/reject',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.rejectContribution
);

export default router;
