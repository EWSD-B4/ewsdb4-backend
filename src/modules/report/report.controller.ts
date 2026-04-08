import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import reportService from './report.service';
import reportFullService from './report-full.service';
import { successResponse } from '@/utils/response';
import { AppError } from '@/middleware/errorHandler';
import { ROLES } from '@/constants/roles';
import academicYearService from '@/modules/academic-year/academic-year.service';

class ReportController {
  getFacultyStatistics = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(req.query.academicYearId as string, 10)
      : await academicYearService.getActiveAcademicYearId();

    const facultyId = this.resolveFacultyId(req);
    const data = await reportService.getFacultyStatistics(facultyId, academicYearId);
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Faculty statistics' }));
  });

  getFacultyExceptions = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(req.query.academicYearId as string, 10)
      : await academicYearService.getActiveAcademicYearId();

    const facultyId = this.resolveFacultyId(req);
    const data = await reportService.getFacultyExceptions(facultyId, academicYearId);
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Faculty exceptions' }));
  });

  getContributionsByFaculty = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(req.query.academicYearId as string, 10)
      : await academicYearService.getActiveAcademicYearId();
    const facultyId = req.query.facultyId ? parseInt(req.query.facultyId as string, 10) : undefined;
    const data = await reportFullService.getContributionsByFaculty({ academicYearId, facultyId });
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Contributions by faculty' }));
  });

  getContributorsByFaculty = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(req.query.academicYearId as string, 10)
      : await academicYearService.getActiveAcademicYearId();
    const facultyId = req.query.facultyId ? parseInt(req.query.facultyId as string, 10) : undefined;
    const data = await reportFullService.getContributorsByFaculty({ academicYearId, facultyId });
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Contributors by faculty' }));
  });

  getContributionPercentages = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(req.query.academicYearId as string, 10)
      : await academicYearService.getActiveAcademicYearId();
    const data = await reportFullService.getContributionPercentages(academicYearId);
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Contribution percentages' }));
  });

  getContributionsWithoutComments = asyncHandler(async (req: Request, res: Response) => {
    const role = String(req.user?.role).toUpperCase();
    const facultyId = role === 'COORDINATOR'
      ? req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined
      : req.query.facultyId ? parseInt(req.query.facultyId as string, 10) : undefined;
    const data = await reportFullService.getContributionsWithoutComments(facultyId);
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Contributions without comments' }));
  });

  getOverdueContributions = asyncHandler(async (req: Request, res: Response) => {
    const role = String(req.user?.role).toUpperCase();
    const facultyId = role === 'COORDINATOR'
      ? req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined
      : req.query.facultyId ? parseInt(req.query.facultyId as string, 10) : undefined;
    const data = await reportFullService.getOverdueContributions(facultyId);
    res.json(successResponse(data, req.requestId || 'unknown', { message: 'Overdue contributions (no comment after 14 days)' }));
  });

  getSystemUsage = asyncHandler(async (_req: Request, res: Response) => {
    const data = await reportFullService.getSystemUsageReport();
    res.json(successResponse(data, _req.requestId || 'unknown', { message: 'System usage report' }));
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
