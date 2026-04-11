import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { ROLES } from '@/constants/roles';
import contributionController from './contribution.controller';
import documentContentController from '@/modules/document/document-content.controller';

const router = Router();

router.get('/faculties', contributionController.listGuestFaculties);
router.get(
  '/faculties/:facultyId/contributions/selected',
  contributionController.listGuestSelected
);
router.get('/contributions/:id', contributionController.getGuestSelected);

router.get(
  '/contributions/:id/content',
  authenticate,
  authorize(ROLES.GUEST),
  documentContentController.getForGuest
);

export default router;
