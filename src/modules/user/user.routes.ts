import { Router } from 'express';
import userController from './user.controller';
import { validate } from '@/middleware/validation';
import { createUserSchema, updateUserSchema } from './user.validation';

const router = Router();

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', validate(createUserSchema), userController.createUser);
router.put('/:id', validate(updateUserSchema), userController.updateUser);
router.delete('/:id', userController.deleteUser);

export default router;
