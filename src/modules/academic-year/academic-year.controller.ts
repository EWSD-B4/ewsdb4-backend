import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import academicYearService from './academic-year.service';
import { successResponse } from '@/utils/response';
import { validate } from '@/middleware/validate';
import { createAcademicYearSchema, updateAcademicYearSchema } from './academic-year.validation';
import { CreateAcademicYearRequest, UpdateAcademicYearRequest } from './academic-year.types';

class AcademicYearController {
  createAcademicYear = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = validate<CreateAcademicYearRequest>(createAcademicYearSchema, req.body);
    const academicYear = await academicYearService.createAcademicYear(validatedData);

    return res.status(201).json(
      successResponse(academicYear, req.requestId || 'unknown', {
        message: 'Academic year created successfully',
      })
    );
  });

  getAcademicYears = asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const academicYears = await academicYearService.getAcademicYears(includeInactive);

    return res.json(
      successResponse(
        { academicYears, total: academicYears.length },
        req.requestId || 'unknown',
        {
          message: 'Academic years retrieved successfully',
        }
      )
    );
  });

  getAcademicYearById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const academicYear = await academicYearService.getAcademicYearById(id);

    return res.json(
      successResponse(academicYear, req.requestId || 'unknown', {
        message: 'Academic year retrieved successfully',
      })
    );
  });

  getCurrentAcademicYear = asyncHandler(async (req: Request, res: Response) => {
    const academicYear = await academicYearService.getCurrentAcademicYear();

    if (!academicYear) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: 'No current academic year set',
        requestId: req.requestId || 'unknown',
      });
    }

    return res.json(
      successResponse(academicYear, req.requestId || 'unknown', {
        message: 'Current academic year retrieved successfully',
      })
    );
  });

  updateAcademicYear = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const validatedData = validate<UpdateAcademicYearRequest>(updateAcademicYearSchema, req.body);
    const academicYear = await academicYearService.updateAcademicYear(id, validatedData);

    return res.json(
      successResponse(academicYear, req.requestId || 'unknown', {
        message: 'Academic year updated successfully',
      })
    );
  });

  setCurrentAcademicYear = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const academicYear = await academicYearService.setCurrentAcademicYear(id);

    return res.json(
      successResponse(academicYear, req.requestId || 'unknown', {
        message: 'Current academic year set successfully',
      })
    );
  });

  deleteAcademicYear = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    await academicYearService.deleteAcademicYear(id);

    return res.json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'Academic year deleted successfully',
      })
    );
  });
}

export default new AcademicYearController();
