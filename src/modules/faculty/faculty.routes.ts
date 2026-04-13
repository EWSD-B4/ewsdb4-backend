import { Router } from 'express';
import facultyController from './faculty.controller';
import { validateZod } from '@/middleware/validateZod';
import { facultyCreateSchema, facultyUpdateSchema } from './faculty.validation';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { ROLES } from '@/constants/roles';

const router = Router();

router.post(
  '/',
  authenticate,
  authorize(ROLES.ADMIN),
  validateZod(facultyCreateSchema),
  facultyController.createFaculty
);
router.get('/', facultyController.listFaculties);
router.patch(
  '/:id',
  authenticate,
  authorize(ROLES.ADMIN),
  validateZod(facultyUpdateSchema),
  facultyController.updateFaculty
);
router.patch(
  '/:id/deactivate',
  authenticate,
  authorize(ROLES.ADMIN),
  facultyController.deactivateFaculty
);

export default router;
