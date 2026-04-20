import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import contributionService from './contribution.service';
import { successResponse } from '@/utils/response';
import { db as prisma } from '@/shared/database';
import { AppError } from '@/middleware/errorHandler';
import archiver from 'archiver';
import s3Service from '@/shared/storage/s3.service';
import academicYearService from '@/modules/academic-year/academic-year.service';
import logger from '@/shared/logger';

class ContributionController {
  private async resolveContributionPeriodRange(
    filterBy: string,
    academicYearId: number
  ): Promise<{ gte?: Date; lt?: Date }> {
    const normalized = filterBy.toLowerCase();
    const now = new Date();

    if (normalized === 'this_week') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { gte: start, lt: end };
    }

    if (normalized === 'this_month') {
      return {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    }

    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { id: true, startDate: true, endDate: true },
    });

    if (!academicYear) {
      throw new AppError('Academic year not found', 404, 'NOT_FOUND');
    }

    const start = new Date(academicYear.startDate);
    const end = new Date(academicYear.endDate);
    const midpoint = new Date((start.getTime() + end.getTime()) / 2);

    if (normalized === 'this_semester') {
      return now < midpoint ? { gte: start, lt: midpoint } : { gte: midpoint, lt: end };
    }

    if (normalized === 'last_semester') {
      if (now >= midpoint) {
        return { gte: start, lt: midpoint };
      }

      const previousAcademicYear = await prisma.academicYear.findFirst({
        where: { startDate: { lt: academicYear.startDate }, isActive: true },
        orderBy: { startDate: 'desc' },
        select: { startDate: true, endDate: true },
      });

      if (!previousAcademicYear) {
        return {};
      }

      const previousMidpoint = new Date(
        (previousAcademicYear.startDate.getTime() + previousAcademicYear.endDate.getTime()) / 2
      );
      return { gte: previousMidpoint, lt: previousAcademicYear.endDate };
    }

    return {};
  }

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

  listManager = asyncHandler(async (req: Request, res: Response) => {
    const limitRaw = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offsetRaw = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const result = await contributionService.listManagerContributions(limit, offset);
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
    const rawAcademicYearId = req.body.academicYearId
      ? parseInt(String(req.body.academicYearId), 10)
      : null;
    const academicYearId: number = rawAcademicYearId ?? await academicYearService.getActiveAcademicYearId();

    if (!title) {
      res.status(400).json({
        success: false,
        message: 'Title is required',
        ...(process.env.NODE_ENV === 'development'
          ? { stack: new Error('Title is required').stack }
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
    let comment = req.body?.comment as string | undefined;

    logger.info(`contributionId: ${contributionId}`);
    logger.info(`coordinatorId: ${coordinatorId}`);

    // If comment is not in body, fetch from database
    if (!comment || typeof comment !== 'string' || comment.trim() === '') {
      const existingComment = await prisma.comment.findFirst({
        where: {
          contributionId,
          userId: coordinatorId,
        },
        orderBy: { createdAt: 'desc' },
        select: { content: true },
      });

      logger.info(`Existing comment: ${JSON.stringify(existingComment)}`);

      if (existingComment?.content) {
        comment = existingComment.content;
      } else {
        res.status(400).json({
          success: false,
          message: 'Comment is required when selecting a contribution',
          ...(process.env.NODE_ENV === 'development'
            ? { stack: new Error('Comment is required').stack }
            : {}),
        });
        return;
      }
    }

    const result = await contributionService.selectContribution(
      contributionId,
      coordinatorId,
      facultyId,
      comment.trim()
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
    let comment = req.body?.comment as string | undefined;

    // If comment is not in body, fetch from database
    if (!comment || typeof comment !== 'string' || comment.trim() === '') {
      const existingComment = await prisma.comment.findFirst({
        where: {
          contributionId,
          userId: coordinatorId,
        },
        orderBy: { createdAt: 'desc' },
        select: { content: true },
      });

      if (existingComment?.content) {
        comment = existingComment.content;
      } else {
        res.status(400).json({
          success: false,
          message: 'Comment is required when rejecting a contribution',
          ...(process.env.NODE_ENV === 'development'
            ? { stack: new Error('Comment is required').stack }
            : {}),
        });
        return;
      }
    }

    const result = await contributionService.rejectContribution(
      contributionId,
      coordinatorId,
      facultyId,
      comment.trim()
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

    const files = req.files as { docx?: Express.Multer.File[]; images?: Express.Multer.File[]; image?: Express.Multer.File[] };
    const docxFile = files?.docx?.[0];
    const imageFiles = [...(files?.images ?? []), ...(files?.image ?? [])];
    const title = req.body.title as string | undefined;

    if (!docxFile && imageFiles.length === 0 && !title) {
      res.status(400).json({ success: false, message: 'At least one file (DOCX or images) or title is required' });
      return;
    }

    const contributionId = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.user.id), 10);

    const result = await contributionService.replaceContributionFiles(
      contributionId,
      userId,
      title,
      docxFile,
      imageFiles
    );

    res.json(
      successResponse(result, req.requestId || 'unknown', {
        message: 'Contribution updated successfully',
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

    const simplifiedItems = items.map((c: any) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      student: c.user ? `${c.user.firstName} ${c.user.lastName}` : null,
      faculty: c.faculty ? c.faculty.facultyName : null,
      academicYear: c.academicYear ? c.academicYear.yearName : null,
    }));

    res.json(
      successResponse({ simplifiedItems, total }, req.requestId || 'unknown', {
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
      : await academicYearService.getActiveAcademicYearId();

    const where = { academicYearId };

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
      : await academicYearService.getActiveAcademicYearId();
    const filterBy = String(req.query.filterBy || 'all').toLowerCase();
    const allowedFilters = ['all', 'this_semester', 'last_semester', 'this_month', 'this_week'];
    const dateRange = allowedFilters.includes(filterBy)
      ? await this.resolveContributionPeriodRange(filterBy, academicYearId)
      : {};

    const contributions = await prisma.contribution.groupBy({
      by: ['facultyId', 'academicYearId'],
      _count: { id: true },
      where: {
        academicYearId,
        createdAt: dateRange.gte || dateRange.lt ? { gte: dateRange.gte, lt: dateRange.lt } : undefined,
      },
    });

    const total = await prisma.contribution.count({
      where: {
        academicYearId,
        createdAt: dateRange.gte || dateRange.lt ? { gte: dateRange.gte, lt: dateRange.lt } : undefined,
      },
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
        { items: enrichedData, total, filterBy },
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
        } as any,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          faculty: { select: { id: true, facultyName: true, facultyCode: true } },
          academicYear: { select: { id: true, yearName: true } },
        },
        orderBy: { commentDueDate: 'asc' } as any,
      }),
    ]);

    const formatContribution = (c: any) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      student: `${c.user.firstName || ''} ${c.user.lastName || ''}`.trim(),
      faculty: c.faculty.facultyName,
      academicYear: c.academicYear.yearName,
    });

    const items = [
      ...contributionsWithoutComments.map(formatContribution),
      ...contributionsOverdue.map(formatContribution),
    ];

    res.json(
      successResponse(
        {
          items,
          total: items.length,
        },
        req.requestId || 'unknown',
        { message: 'Exception report retrieved' }
      )
    );
  });
  downloadSelectedAsZip = (req: Request, res: Response) => {
    (async () => {
      try {
        const academicYearId = req.query.academicYearId
          ? parseInt(req.query.academicYearId as string, 10)
          : await academicYearService.getActiveAcademicYearId();

        // Check if final closure date has passed
        const academicYear = await prisma.academicYear.findUnique({
          where: { id: academicYearId },
          select: { closureFinalDate: true },
        });

        if (!academicYear) {
          res.status(404).json({
            success: false,
            message: 'Academic year not found',
          });
          return;
        }

        const now = new Date();
        if (!academicYear.closureFinalDate || now < academicYear.closureFinalDate) {
          res.status(403).json({
            success: false,
            message: 'Download is only available after the final closure date',
          });
          return;
        }

        const where = { status: 'selected', academicYearId };

        const contributions = await prisma.contribution.findMany({
          where,
          include: {
            files: { orderBy: { createdAt: 'asc' } },
            user: { select: { firstName: true, lastName: true } },
            faculty: { select: { facultyCode: true } },
          },
        });

        if (contributions.length === 0) {
          res.status(404).json({
            success: false,
            message: 'No selected contributions found',
          });
          return;
        }

        const zipFilename = `selected-contributions${academicYearId ? `-ay${academicYearId}` : ''}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err: Error) => {
          logger.error(`Archive error: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Error creating ZIP file',
            });
          }
        });

        archive.pipe(res);

        let filesAdded = 0;
        for (const contribution of contributions) {
          const authorName = `${contribution.user.firstName || ''}_${contribution.user.lastName || ''}`.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
          const folderName = `${contribution.faculty.facultyCode}_${contribution.id}_${authorName}`;

          // Add DOCX file
          const docxFile = contribution.files.find(f => f.fileType === 'docx');
          if (docxFile?.filePath) {
            try {
              const buffer = await s3Service.downloadFile(docxFile.filePath);
              const sanitizedOriginalName = docxFile.originalName?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document.docx';
              archive.append(buffer, { name: `${folderName}/${sanitizedOriginalName}` });
              filesAdded++;
            } catch (error) {
              logger.warn(`Failed to download DOCX file for contribution ${contribution.id}: ${error}`);
            }
          }

          // Add image files
          const imageFiles = contribution.files.filter(f => f.fileType === 'image');
          if (imageFiles.length > 0) {
            // Create images folder by adding an empty file to ensure folder exists
            archive.append('', { name: `${folderName}/images/.gitkeep` });
            
            for (const imageFile of imageFiles) {
              if (imageFile?.filePath) {
                try {
                  const buffer = await s3Service.downloadFile(imageFile.filePath);
                  const sanitizedImageName = imageFile.originalName?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'image';
                  archive.append(buffer, { name: `${folderName}/images/${sanitizedImageName}` });
                  filesAdded++;
                } catch (error) {
                  logger.warn(`Failed to download image file for contribution ${contribution.id}: ${error}`);
                }
              }
            }
          }
        }

        logger.info(`Added ${filesAdded} files to ZIP archive for academic year ${academicYearId}`);
        await archive.finalize();
      } catch (error) {
        logger.error(`Error in downloadSelectedAsZip: ${error}`);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Internal server error',
          });
        }
      }
    })();
  };

  getContributionsWithoutComments = asyncHandler(async (req: Request, res: Response) => {
    const facultyId = req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined;
    if (!facultyId) {
      throw new AppError('Faculty assignment required', 403, 'FORBIDDEN');
    }

    const contributions = await prisma.contribution.findMany({
      where: {
        status: 'submitted',
        facultyId,
        comments: { none: {} },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        faculty: { select: { facultyName: true } },
        academicYear: { select: { yearName: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const items = contributions.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      student: `${c.user.firstName || ''} ${c.user.lastName || ''}`.trim(),
      faculty: c.faculty.facultyName,
      academicYear: c.academicYear.yearName,
    }));

    res.json(
      successResponse(
        { items, total: items.length },
        req.requestId || 'unknown',
        { message: 'Contributions retrieved' }
      )
    );
  });

  getOverdueContributions = asyncHandler(async (req: Request, res: Response) => {
    const facultyId = req.user?.facultyId ? parseInt(String(req.user.facultyId), 10) : undefined;
    if (!facultyId) {
      throw new AppError('Faculty assignment required', 403, 'FORBIDDEN');
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const contributions = await prisma.contribution.findMany({
      where: {
        status: 'submitted',
        facultyId,
        submittedAt: { lt: fourteenDaysAgo },
        comments: { none: {} },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        faculty: { select: { facultyName: true } },
        academicYear: { select: { yearName: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const items = contributions.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      student: `${c.user.firstName || ''} ${c.user.lastName || ''}`.trim(),
      faculty: c.faculty.facultyName,
      academicYear: c.academicYear.yearName,
    }));

    res.json(
      successResponse(
        { items, total: items.length },
        req.requestId || 'unknown',
        { message: 'Contributions retrieved' }
      )
    );
  });
}

export default new ContributionController();
