import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { verifyToken } from '@/utils/jwt';
import { asyncHandler } from './asyncHandler';
import cache from '@/shared/cache/redis';

export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Authentication required. Please provide a valid token.',
        401,
        'UNAUTHORIZED'
      );
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError(
        'Authentication required. Please provide a valid token.',
        401,
        'UNAUTHORIZED'
      );
    }

    const decoded = verifyToken(token);

    const loginState = await cache.get(`auth:state:user:${decoded.userId}`);
    if (loginState !== 'logged_in') {
      throw new AppError('Authentication required. Please login again.', 401, 'UNAUTHORIZED');
    }

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: String(decoded.role).toUpperCase(),
    };

    next();
  }
);
