import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import contributionService from './contribution.service';
import { successResponse } from '@/utils/response';
import { db as prisma } from '@/shared/database';
import {AppError} from "@/middleware/errorHandler";

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

  submit = asyncHandler(async (req: Request, res: Response) => {
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
    const title = req.body.title as string | undefined;
    const academicYearId = req.body.academicYearId as number | undefined;

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
      String(title),
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

  getStudentContributions = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const limitRaw = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offsetRaw = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const userId = Number(req.user.id);
    const contributions = await contributionService.getContributionsByStudentId(userId, limit, offset);
    res.json(
        successResponse(contributions, req.requestId || 'unknown', {
          message: 'Contribution retrieved',
        })
    );
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
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

    const contributionId = parseInt(String(req.params.id), 10);
    const status = req.body.status as string | undefined;

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Status is required').stack }
          : {}),
      });
      return;
    }

    const updated = await contributionService.updateContributionStatus(
      contributionId,
      facultyId,
      String(status)
    );

    res.json(
      successResponse(updated, req.requestId || 'unknown', {
        message: `Contribution status updated to ${status}`,
      })
    );
  });

  selectContribution = asyncHandler(async (req: Request, res: Response) => {
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

    const contributionId = parseInt(String(req.params.id), 10);
    const coordinatorId = parseInt(String(req.user!.id), 10);
    const comment = req.body.comment as string | undefined;

    if (!comment) {
      res.status(400).json({
        success: false,
        message: 'Comment is required when selecting a contribution',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Comment is required').stack }
          : {}),
      });
      return;
    }

    const result = await contributionService.selectContribution(
      contributionId,
      coordinatorId,
      facultyId,
      String(comment)
    );

    res.json(
      successResponse(result, req.requestId || 'unknown', {
        message: 'Contribution selected successfully',
      })
    );
  });

  rejectContribution = asyncHandler(async (req: Request, res: Response) => {
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

    const contributionId = parseInt(String(req.params.id), 10);
    const coordinatorId = parseInt(String(req.user!.id), 10);
    const comment = req.body.comment as string | undefined;

    if (!comment) {
      res.status(400).json({
        success: false,
        message: 'Comment is required when rejecting a contribution',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Comment is required').stack }
          : {}),
      });
      return;
    }

    const result = await contributionService.rejectContribution(
      contributionId,
      coordinatorId,
      facultyId,
      String(comment)
    );

    res.json(
      successResponse(result, req.requestId || 'unknown', {
        message: 'Contribution rejected successfully',
      })
    );
  });

  replaceContributionFiles = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const files = req.files as { docx?: Express.Multer.File[]; images?: Express.Multer.File[] };
    const docxFile = files?.docx?.[0];

    if (!docxFile) {
      res.status(400).json({ success: false, message: 'DOCX file is required' });
      return;
    }

    const contributionId = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.user.id), 10);
    const imageFiles = files?.images ?? [];

    const result = await contributionService.replaceContributionFiles(
      contributionId,
      userId,
      docxFile,
      imageFiles
    );

    res.json(
      successResponse(result, req.requestId || 'unknown', {
        message: 'Contribution files replaced and queued for processing',
      })
    );
  });

  deleteStudentContribution = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const contributionId = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.user.id), 10);

    await contributionService.deleteStudentContribution(contributionId, userId);

    res.json(
      successResponse(null, req.requestId || 'unknown', {
        message: 'Contribution deleted successfully',
      })
    );
  });

  updateContribution = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const contributionId = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.user.id), 10);
    const title = req.body.title as string | undefined;

    const updated = await contributionService.updateContribution(
      contributionId,
      userId,
      { title }
    );

    res.json(
      successResponse(updated, req.requestId || 'unknown', {
        message: 'Contribution updated successfully',
      })
    );
  });

  listAllSelected = asyncHandler(async (req: Request, res: Response) => {
    const limitRaw = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offsetRaw = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const where = { status: 'selected' };
    const [items, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          faculty: { select: { id: true, facultyName: true, facultyCode: true } },
          academicYear: { select: { id: true, yearName: true } },
        },
      }),
      prisma.contribution.count({ where }),
    ]);

    res.json(
      successResponse({ items, total }, req.requestId || 'unknown', {
        message: 'Selected contributions retrieved',
        pagination: { limit, offset, total },
      })
    );
  });

  getSelectedContribution = asyncHandler(async (req: Request, res: Response) => {
    const contributionId = parseInt(String(req.params.id), 10);
    const contribution = await prisma.contribution.findFirst({
      where: { id: contributionId, status: 'selected' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        faculty: { select: { id: true, facultyName: true, facultyCode: true } },
        academicYear: { select: { id: true, yearName: true } },
        files: true,
        comments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!contribution) {
      res.status(404).json({
        success: false,
        message: 'Selected contribution not found',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Selected contribution not found').stack }
          : {}),
      });
      return;
    }

    res.json(
      successResponse(contribution, req.requestId || 'unknown', {
        message: 'Contribution retrieved',
      })
    );
  });

  getStatistics = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(req.query.academicYearId as string, 10)
      : undefined;

    const where = academicYearId ? { academicYearId } : {};

    const [
      totalContributions,
      submittedContributions,
      selectedContributions,
      publishedContributions,
      rejectedContributions,
      contributionsWithoutComments,
    ] = await Promise.all([
      prisma.contribution.count({ where }),
      prisma.contribution.count({ where: { ...where, status: 'submitted' } }),
      prisma.contribution.count({ where: { ...where, status: 'selected' } }),
      prisma.contribution.count({ where: { ...where, status: 'published' } }),
      prisma.contribution.count({ where: { ...where, status: 'rejected' } }),
      prisma.contribution.count({
        where: {
          ...where,
          status: { in: ['submitted', 'under_review'] },
          comments: { none: {} },
        },
      }),
    ]);

    res.json(
      successResponse(
        {
          totalContributions,
          submittedContributions,
          selectedContributions,
          publishedContributions,
          rejectedContributions,
          contributionsWithoutComments,
        },
        req.requestId || 'unknown',
        { message: 'Statistics retrieved' }
      )
    );
  });

  getFacultyYearReport = asyncHandler(async (req: Request, res: Response) => {
    const academicYearId = req.query.academicYearId
      ? parseInt(req.query.academicYearId as string, 10)
      : undefined;

    const contributions = await prisma.contribution.groupBy({
      by: ['facultyId', 'academicYearId'],
      _count: { id: true },
      where: academicYearId ? { academicYearId } : {},
    });

    const total = await prisma.contribution.count({
      where: academicYearId ? { academicYearId } : {},
    });

    const enrichedData = await Promise.all(
      contributions.map(async (item) => {
        const faculty = await prisma.faculty.findUnique({
          where: { id: item.facultyId },
          select: { facultyName: true, facultyCode: true },
        });
        const academicYear = await prisma.academicYear.findUnique({
          where: { id: item.academicYearId },
          select: { yearName: true },
        });

        return {
          facultyId: item.facultyId,
          facultyName: faculty?.facultyName,
          facultyCode: faculty?.facultyCode,
          academicYearId: item.academicYearId,
          yearName: academicYear?.yearName,
          count: item._count.id,
          percentage: total > 0 ? ((item._count.id / total) * 100).toFixed(2) : '0.00',
        };
      })
    );

    res.json(
      successResponse(
        { items: enrichedData, total },
        req.requestId || 'unknown',
        { message: 'Faculty year report retrieved' }
      )
    );
  });

  getExceptionReport = asyncHandler(async (req: Request, res: Response) => {
    const now = new Date();

    const [contributionsWithoutComments, contributionsOverdue] = await Promise.all([
      prisma.contribution.findMany({
        where: {
          status: { in: ['submitted', 'under_review'] },
          comments: { none: {} },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          faculty: { select: { id: true, facultyName: true, facultyCode: true } },
          academicYear: { select: { id: true, yearName: true } },
        },
        orderBy: { submittedAt: 'asc' },
      }),
      prisma.contribution.findMany({
        where: {
          status: { in: ['submitted', 'under_review'] },
          commentDueDate: { lt: now },
          comments: { none: {} },
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          faculty: { select: { id: true, facultyName: true, facultyCode: true } },
          academicYear: { select: { id: true, yearName: true } },
        },
        orderBy: { commentDueDate: 'asc' },
      }),
    ]);

    res.json(
      successResponse(
        {
          contributionsWithoutComments,
          contributionsOverdue,
          totalWithoutComments: contributionsWithoutComments.length,
          totalOverdue: contributionsOverdue.length,
        },
        req.requestId || 'unknown',
        { message: 'Exception report retrieved' }
      )
    );
  });
}

export default new ContributionController();
