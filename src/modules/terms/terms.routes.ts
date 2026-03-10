import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import termsController from './terms.controller';

const router = Router();

router.post('/', authenticate, authorize('ADMIN'), termsController.createTerms);

router.get('/', authenticate, termsController.getAllTerms);

router.get('/active', termsController.getActiveTerms);

router.get('/:id', authenticate, termsController.getTermsById);

router.put('/:id', authenticate, authorize('ADMIN'), termsController.updateTerms);

router.put('/:id/set-active', authenticate, authorize('ADMIN'), termsController.setActiveTerms);

router.delete('/:id', authenticate, authorize('ADMIN'), termsController.deleteTerms);

export default router;
