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
}

export default new AuthController();
