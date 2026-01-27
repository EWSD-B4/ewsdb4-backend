import { Request, Response } from 'express';
import authService from './auth.service';
import { asyncHandler } from '@/middleware/asyncHandler';
import { ApiResponse } from '@/types/common';
import { AuthResponse } from './auth.types';

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);

    const response: ApiResponse<AuthResponse> = {
      success: true,
      message: 'User registered successfully',
      data: result,
    };

    res.status(201).json(response);
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);

    const response: ApiResponse<AuthResponse> = {
      success: true,
      message: 'Login successful',
      data: result,
    };

    res.status(200).json(response);
  });

  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      message: 'Current user retrieved successfully',
      data: req.user,
    };

    res.status(200).json(response);
  });
}

export default new AuthController();
