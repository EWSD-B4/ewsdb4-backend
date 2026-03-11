import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import contributionService from './contribution.service';
import { successResponse } from '@/utils/response';
import { db as prisma } from '@/shared/database';

class ContributionController {
  listCoordinator = asyncHandler(async (req: Request, res: Response) => {
    const facultyId = req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined;
    if (!facultyId) {
      res.status(403).json({
        success: false,
        message: 'Faculty assignment required',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Faculty assignment required').stack }
          : {}),
      });
      return;
    }

    const limitRaw = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offsetRaw = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const result = await contributionService.listCoordinatorContributions(facultyId, limit, offset);
    res.json(
      successResponse({ items: result.items, total: result.total }, req.requestId || 'unknown', {
        message: 'Contributions retrieved',
        pagination: { limit, offset, total: result.total },
      })
    );
  });

  getCoordinator = asyncHandler(async (req: Request, res: Response) => {
    const facultyId = req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined;
    if (!facultyId) {
      res.status(403).json({
        success: false,
        message: 'Faculty assignment required',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Faculty assignment required').stack }
          : {}),
      });
      return;
    }

    const contributionId = String(req.params.id);
    const contribution = await contributionService.getCoordinatorContribution(
      facultyId,
      contributionId
    );
    res.json(
      successResponse(contribution, req.requestId || 'unknown', {
        message: 'Contribution retrieved',
      })
    );
  });

  createStudent = asyncHandler(async (req: Request, res: Response) => {
    const facultyId = req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined;
    if (!facultyId) {
      res.status(403).json({
        success: false,
        message: 'Faculty assignment required',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Faculty assignment required').stack }
          : {}),
      });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files || !files.docx || files.docx.length === 0) {
      res.status(400).json({
        success: false,
        message: 'DOCX file is required',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('DOCX file is required').stack }
          : {}),
      });
      return;
    }

    const docxFile = files.docx[0];
    const imageFiles = files.images || [];

    if (imageFiles.length > 5) {
      res.status(400).json({
        success: false,
        message: 'Maximum 5 images allowed',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Maximum 5 images allowed').stack }
          : {}),
      });
      return;
    }

    const userId = parseInt(String(req.user!.id), 10);
    const { title, academicYearId } = req.body;

    if (!title || !academicYearId) {
      res.status(400).json({
        success: false,
        message: 'Title and academicYearId are required',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Title and academicYearId are required').stack }
          : {}),
      });
      return;
    }

    const result = await contributionService.createStudentContribution(
      userId,
      facultyId,
      parseInt(String(academicYearId), 10),
      title,
      docxFile,
      imageFiles
    );

    res.status(201).json(
      successResponse(result, req.requestId || 'unknown', {
        message: `Contribution created successfully. DOCX file is being processed. ${imageFiles.length} image(s) uploaded.`,
      })
    );
  });

  listGuestFaculties = asyncHandler(async (req: Request, res: Response) => {
    const faculties = await prisma.faculty.findMany({
      where: { isActive: true },
      orderBy: { facultyName: 'asc' },
      select: { id: true, facultyCode: true, facultyName: true },
    });
    res.json(
      successResponse(faculties, req.requestId || 'unknown', { message: 'Faculties retrieved' })
    );
  });

  listGuestSelected = asyncHandler(async (req: Request, res: Response) => {
    const limitRaw = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offsetRaw = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const facultyId = parseInt(String(req.params.facultyId), 10);
    if (!Number.isFinite(facultyId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid facultyId',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Invalid facultyId').stack }
          : {}),
      });
      return;
    }

    const result = await contributionService.listGuestSelected(facultyId, limit, offset);
    res.json(
      successResponse({ items: result.items, total: result.total }, req.requestId || 'unknown', {
        message: 'Selected contributions retrieved',
        pagination: { limit, offset, total: result.total },
      })
    );
  });

  getGuestSelected = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = String(req.params.id);
    const contribution = await contributionService.getGuestSelected(contributionId);
    res.json(
      successResponse(contribution, req.requestId || 'unknown', {
        message: 'Contribution retrieved',
      })
    );
  });
}

export default new ContributionController();
