import { Router } from 'express';
import adminController from './admin.controller';
import { authorize } from '@/middleware/authorize';
import { authenticate } from '@/middleware/auth';
import { validateZod } from '@/middleware/validateZod';
import { assignFacultySchema } from './admin.validation';
import facultyRoutes from '@/modules/faculty/faculty.routes';
import { ROLES } from '@/constants/roles';

const router = Router();

router.use('/faculties', authenticate, authorize(ROLES.ADMIN), facultyRoutes);
router.patch(
  '/users/:id/faculty',
  authenticate,
  authorize(ROLES.ADMIN),
  validateZod(assignFacultySchema),
  adminController.assignUserFaculty
);
router.get(
  '/faculties/:id/users',
  authenticate,
  authorize(ROLES.ADMIN),
  adminController.listFacultyUsers
);

export default router;
