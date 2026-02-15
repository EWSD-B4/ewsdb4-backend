import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { asyncHandler } from './asyncHandler';

export const authorize = (...allowedRoles: string[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('You do not have permission to perform this action', 403);
    }

    next();
  });
};
