import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import reportService from './report.service';
import { successResponse } from '@/utils/response';
import { AppError } from '@/middleware/errorHandler';
import { ROLES } from '@/constants/roles';

class ReportController {
  getFacultyStatistics = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId as string;
    if (!academicYearId) {
      throw new AppError('academicYearId is required', 400, 'VALIDATION_ERROR');
    }

    const facultyId = this.resolveFacultyId(req);
    const data = await reportService.getFacultyStatistics(facultyId, parseInt(academicYearId, 10));
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Faculty statistics' }));
  });

  getFacultyExceptions = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId as string;
    if (!academicYearId) {
      throw new AppError('academicYearId is required', 400, 'VALIDATION_ERROR');
    }

    const facultyId = this.resolveFacultyId(req);
    const data = await reportService.getFacultyExceptions(facultyId, parseInt(academicYearId, 10));
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Faculty exceptions' }));
  });

  private resolveFacultyId(req: Request): number {
    const normalizedRole = req.user?.role ? String(req.user.role).toUpperCase() : '';
    if (normalizedRole === ROLES.COORDINATOR && req.user) {
      if (!req.user.facultyId) {
        throw new AppError('Faculty assignment required', 403, 'FORBIDDEN');
      }
      const facultyIdNum = parseInt(String(req.user.facultyId), 10);
      if (!Number.isFinite(facultyIdNum)) {
        throw new AppError('Invalid faculty id', 400, 'VALIDATION_ERROR');
      }
      return facultyIdNum;
    }

    const facultyIdNum = parseInt(String(req.params.facultyId), 10);
    if (!Number.isFinite(facultyIdNum)) {
      throw new AppError('Invalid faculty id', 400, 'VALIDATION_ERROR');
    }
    return facultyIdNum;
  }
}

export default new ReportController();
