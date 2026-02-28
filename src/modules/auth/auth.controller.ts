import { Request, Response } from 'express';
import authService from './auth.service';
import { asyncHandler } from '@/middleware/asyncHandler';
import { successResponse } from '@/utils/response';

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json(successResponse(result, req.requestId || 'unknown', { message: 'User registered successfully' }));
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.status(200).json(successResponse(result, req.requestId || 'unknown', { message: 'Login successful' }));
  });

  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    res
      .status(200)
      .json(successResponse(req.user, req.requestId || 'unknown', { message: 'Current user retrieved successfully' }));
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.user!.id);
    res.status(200).json(successResponse({ success: true }, req.requestId || 'unknown', { message: 'Logout successful' }));
  });
}

export default new AuthController();
