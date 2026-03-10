import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import academicYearController from './academic-year.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  academicYearController.createAcademicYear
);

router.get('/', authenticate, academicYearController.getAcademicYears);

router.get('/current', authenticate, academicYearController.getCurrentAcademicYear);

router.get('/:id', authenticate, academicYearController.getAcademicYearById);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  academicYearController.updateAcademicYear
);

router.put(
  '/:id/set-current',
  authenticate,
  authorize('ADMIN'),
  academicYearController.setCurrentAcademicYear
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  academicYearController.deleteAcademicYear
);

export default router;
