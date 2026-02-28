import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import facultyService from './faculty.service';
import { successResponse } from '@/utils/response';
import { facultyListQuerySchema } from './faculty.validation';
import { ValidationError } from '@/shared/errors/AppError';

class FacultyController {
  createFaculty = asyncHandler(async (req: Request, res: Response) => {
    const faculty = await facultyService.createFaculty(req.body as { code: string; name: string });
    res
      .status(201)
      .json(successResponse(faculty, req.requestId || 'unknown', { message: 'Faculty created' }));
  });

  listFaculties = asyncHandler(async (req: Request, res: Response) => {
    const parsed = facultyListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', parsed.error.flatten());
    }

    const result = await facultyService.listFaculties(parsed.data);
    res.json(
      successResponse(
        {
          items: result.items,
          total: result.total,
        },
        req.requestId || 'unknown',
        {
          message: 'Faculties retrieved',
          pagination: { limit: result.limit, offset: result.offset, total: result.total },
        }
      )
    );
  });

  updateFaculty = asyncHandler(async (req: Request, res: Response) => {
    const facultyId = String(req.params.id);
    const faculty = await facultyService.updateFaculty(
      facultyId,
      req.body as { code?: string; name?: string; isActive?: boolean }
    );
    res.json(successResponse(faculty, req.requestId || 'unknown', { message: 'Faculty updated' }));
  });

  deactivateFaculty = asyncHandler(async (req: Request, res: Response) => {
    const facultyId = String(req.params.id);
    const faculty = await facultyService.deactivateFaculty(facultyId);
    res.json(successResponse(faculty, req.requestId || 'unknown', { message: 'Faculty deactivated' }));
  });
}

export default new FacultyController();
