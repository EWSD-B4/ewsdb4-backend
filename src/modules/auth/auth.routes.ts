import { Router } from 'express';
import authController from './auth.controller';
import { validate } from '@/middleware/validation';
import { 
  registerSchema, 
  loginSchema, 
  updatePasswordSchema, 
  forgetPasswordSchema, 
  resetPasswordSchema 
} from './auth.validation';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);

router.put('/password', authenticate, validate(updatePasswordSchema), authController.updatePassword);
router.post('/password/forget', validate(forgetPasswordSchema), authController.forgetPassword);
router.get('/password/reset', authController.verifyResetToken);
router.post('/password/reset', validate(resetPasswordSchema), authController.resetPassword);

export default router;
