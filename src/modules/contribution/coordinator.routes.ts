import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { authenticate } from '@/middleware/auth';
import { requireFacultyIfRoleNeedsIt } from '@/middleware/facultyScope';
import contributionController from './contribution.controller';

const router = Router();

router.get(
  '/contributions',
  authenticate,
  authorize('coordinator'),
  requireFacultyIfRoleNeedsIt,
  contributionController.listCoordinator
);
router.get(
  '/contributions/:id',
  authenticate,
  authorize('coordinator'),
  requireFacultyIfRoleNeedsIt,
  contributionController.getCoordinator
);

export default router;
