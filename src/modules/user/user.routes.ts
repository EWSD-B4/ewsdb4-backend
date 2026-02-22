import { Router } from 'express';
import userController from './user.controller';
import { validate } from '@/middleware/validation';
import { createUserSchema, updateUserSchema } from './user.validation';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { ROLES } from '@/constants/roles';

const router = Router();

router.get('/', authenticate, authorize(ROLES.ADMIN), userController.getAllUsers);
router.get('/:id', authenticate, userController.getUserById);
router.post(
  '/create',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createUserSchema),
  userController.createUser
);
router.put('/:id', authenticate, validate(updateUserSchema), userController.updateUser);
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), userController.deleteUser);

export default router;
