import { Request, Response } from 'express';
import authService from './auth.service';
import { asyncHandler } from '@/middleware/asyncHandler';
import { successResponse } from '@/utils/response';
import { ForgetPasswordDTO, LoginDTO, RegisterDTO, ResetPasswordDTO, UpdatePasswordDTO } from './auth.types';

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body as RegisterDTO);
    res.status(201).json(
      successResponse(result, req.requestId || 'unknown', {
        message: 'User registered successfully',
      })
    );
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body as LoginDTO);
    res
      .status(200)
      .json(successResponse(result, req.requestId || 'unknown', { message: 'Login successful' }));
  });

  getCurrentUser = asyncHandler((req: Request, res: Response) => {
    res.status(200).json(
      successResponse(req.user, req.requestId || 'unknown', {
        message: 'Current user retrieved successfully',
      })
    );
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.user!.id);
    res.status(200).json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'Logout successful',
      })
    );
  });

  updatePassword = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as UpdatePasswordDTO;
    await authService.updatePassword(req.user!.id, payload);
    res.status(200).json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'Password updated successfully',
      })
    );
  });

  forgetPassword = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as ForgetPasswordDTO;
    await authService.forgetPassword(payload);
    res.status(200).json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'Password reset instructions sent to your email',
      })
    );
  });

  verifyResetToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.query;
    const result = await authService.verifyResetToken(token as string);

    if (!result.valid) {
      res.status(400).json(
        successResponse({ valid: false }, req.requestId || 'unknown', {
          message: 'Invalid or expired reset token',
        })
      );
    } else {
      res.status(200).json(
        successResponse(result, req.requestId || 'unknown', {
          message: 'Reset token is valid',
        })
      );
    }
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body as ResetPasswordDTO;
    await authService.resetPassword(payload);
    res.status(200).json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'Password reset successfully',
      })
    );
  });
}

export default new AuthController();
