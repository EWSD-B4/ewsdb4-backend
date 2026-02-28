import { Router } from 'express';
import contributionController from './contribution.controller';

const router = Router();

router.get('/faculties', contributionController.listGuestFaculties);
router.get('/faculties/:facultyId/contributions/selected', contributionController.listGuestSelected);
router.get('/contributions/:id', contributionController.getGuestSelected);

export default router;
