import { Request, Response } from 'express';
import authService from './auth.service';
import { asyncHandler } from '@/middleware/asyncHandler';
import { successResponse } from '@/utils/response';

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json(successResponse('User registered successfully', result));
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.status(200).json(successResponse('Login successful', result));
  });

  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(successResponse('Current user retrieved successfully', req.user));
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.user!.id);
    res.status(200).json(successResponse('Logout successful'));
  });

  updatePassword = asyncHandler(async (req: Request, res: Response) => {
    await authService.updatePassword(req.user!.id, req.body);
    res.status(200).json(successResponse('Password updated successfully'));
  });

  forgetPassword = asyncHandler(async (req: Request, res: Response) => {
    await authService.forgetPassword(req.body);
    res.status(200).json(successResponse('Password reset instructions sent to your email'));
  });

  verifyResetToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query;
    const result = await authService.verifyResetToken(token as string);
    
    if (!result.valid) {
      res.status(400).json(successResponse('Invalid or expired reset token', { valid: false }));
    } else {
      res.status(200).json(successResponse('Reset token is valid', result));
    }
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    res.status(200).json(successResponse('Password reset successfully'));
  });
}

export default new AuthController();
