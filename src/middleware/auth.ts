import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { verifyToken } from '@/utils/jwt';
import { asyncHandler } from './asyncHandler';

export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please provide a valid token.', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Authentication required. Please provide a valid token.', 401);
    }

    const decoded = verifyToken(token);

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  }
);
