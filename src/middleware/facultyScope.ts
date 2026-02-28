import { Request, Response, NextFunction } from 'express';
import prisma from '@/shared/database/prisma';
import { AppError } from './errorHandler';

const rolesRequiringFaculty = new Set(['student', 'coordinator']);

export const requireFacultyIfRoleNeedsIt = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (!rolesRequiringFaculty.has(req.user.role)) {
    return next();
  }

  if (req.user.facultyId) {
    return next();
  }

  const userIdNum = parseInt(req.user.id, 10);
  if (!Number.isFinite(userIdNum)) {
    return next(new AppError('Invalid user id', 400, 'VALIDATION_ERROR'));
  }

  const user = await prisma.user.findUnique({ where: { id: userIdNum } });
  if (!user || !user.facultyId) {
    return next(new AppError('Faculty assignment required', 403, 'FORBIDDEN'));
  }

  req.user.facultyId = String(user.facultyId);
  next();
};

export const enforceContributionFacultyOnCreate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (req.user.role === 'student' || req.user.role === 'coordinator') {
    const facultyIdNum = req.user.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined;
    if (facultyIdNum) {
      req.body.facultyId = facultyIdNum;
    }
  }

  next();
};
