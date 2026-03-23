import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { asyncHandler } from './asyncHandler';
import logger from "@/shared/logger";

export const authorize = (...allowedRoles: string[]) => {
  return asyncHandler((req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const normalizedAllowed = allowedRoles.map((role) => role.toUpperCase());
    const normalizedRole = String(req.user.role).toUpperCase();
    logger.debug("normalizedRole: ", normalizedRole);

    if (!normalizedAllowed.includes(normalizedRole)) {
      throw new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN');
    }

    next();
  });
};
