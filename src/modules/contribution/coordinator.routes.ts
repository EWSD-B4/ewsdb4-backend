import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { authenticate } from '@/middleware/auth';
import { requireFacultyIfRoleNeedsIt } from '@/middleware/facultyScope';
import contributionController from './contribution.controller';
import { ROLES } from '@/constants/roles';

const router = Router();

router.get(
  '/contributions',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.listCoordinator
);
router.get(
  '/contributions/:id',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.getCoordinator
);

export default router;
