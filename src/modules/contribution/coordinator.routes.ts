import { Router } from 'express';
import { authorize } from '@/middleware/authorize';
import { authenticate } from '@/middleware/auth';
import { requireFacultyIfRoleNeedsIt } from '@/middleware/facultyScope';
import { validate } from '@/middleware/validation';
import contributionController from './contribution.controller';
import documentContentController from '@/modules/document/document-content.controller';
import { ROLES } from '@/constants/roles';
import { selectContributionSchema, rejectContributionSchema, updateStatusSchema } from './contribution.validation';

const router = Router();

router.get(
  '/without-comments',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.getContributionsWithoutComments
);

router.get(
  '/overdue',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  contributionController.getOverdueContributions
);

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
  validate(updateStatusSchema),
  contributionController.updateStatus
);

router.post(
  '/:id/select',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  validate(selectContributionSchema),
  contributionController.selectContribution
);

router.post(
  '/:id/reject',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  validate(rejectContributionSchema),
  contributionController.rejectContribution
);

router.get(
  '/:id/content',
  authenticate,
  authorize(ROLES.COORDINATOR),
  requireFacultyIfRoleNeedsIt,
  documentContentController.getForCoordinator
);

export default router;
