import { Router } from 'express';
import authController from './auth.controller';
import { validate } from '@/middleware/validation';
import { registerSchema, loginSchema } from './auth.validation';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
