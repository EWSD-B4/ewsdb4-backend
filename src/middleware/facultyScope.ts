import { Request, Response, NextFunction } from 'express';
import { db as prisma } from '@/shared/database';
import { AppError } from './errorHandler';
import { ROLES } from '@/constants/roles';

const rolesRequiringFaculty = new Set<string>([ROLES.STUDENT, ROLES.COORDINATOR]);
type UserWithFaculty = { facultyId: number | null };

const hasFacultyId = (value: unknown): value is UserWithFaculty => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'facultyId' in value;
};

export const requireFacultyIfRoleNeedsIt = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  if (!rolesRequiringFaculty.has(String(req.user.role).toUpperCase())) {
    return next();
  }

  if (req.user.facultyId) {
    return next();
  }

  const userIdNum = parseInt(req.user.id, 10);
  if (!Number.isFinite(userIdNum)) {
    return next(new AppError('Invalid user id', 400, 'VALIDATION_ERROR'));
  }

  const prismaClient = prisma;
  const userResult: unknown = await prismaClient.user.findUnique({ where: { id: userIdNum } });
  if (!hasFacultyId(userResult) || !userResult.facultyId) {
    return next(new AppError('Faculty assignment required', 403, 'FORBIDDEN'));
  }

  req.user.facultyId = userResult.facultyId;
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

  const role = String(req.user.role).toUpperCase();
  if (role === ROLES.STUDENT || role === ROLES.COORDINATOR) {
    const facultyIdNum = req.user.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined;
    if (facultyIdNum) {
      const body = req.body as Record<string, unknown>;
      body.facultyId = facultyIdNum;
    }
  }

  next();
};
