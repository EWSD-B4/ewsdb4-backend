import { Request, Response } from 'express';
import authService from './auth.service';
import { asyncHandler } from '@/middleware/asyncHandler';
import { successResponse } from '@/utils/response';
import { LoginDTO, RegisterDTO } from './auth.types';

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body as RegisterDTO);
    res.status(201).json(successResponse(result, req.requestId || 'unknown', { message: 'User registered successfully' }));
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body as LoginDTO);
    res.status(200).json(successResponse(result, req.requestId || 'unknown', { message: 'Login successful' }));
  });

  getCurrentUser = asyncHandler((req: Request, res: Response) => {
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
