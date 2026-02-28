import { Router } from 'express';
import adminController from './admin.controller';
import { authorize } from '@/middleware/authorize';
import { authenticate } from '@/middleware/auth';
import { validateZod } from '@/middleware/validateZod';
import { assignFacultySchema } from './admin.validation';
import facultyRoutes from '@/modules/faculty/faculty.routes';

const router = Router();

router.use('/faculties', authenticate, authorize('admin'), facultyRoutes);
router.patch(
  '/users/:id/faculty',
  authenticate,
  authorize('admin'),
  validateZod(assignFacultySchema),
  adminController.assignUserFaculty
);
router.get(
  '/faculties/:id/users',
  authenticate,
  authorize('admin'),
  adminController.listFacultyUsers
);

export default router;
