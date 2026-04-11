import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import commentService from './comment.service';
import { successResponse } from '@/utils/response';
import { validate } from '@/middleware/validate';
import { createCommentSchema, updateCommentSchema } from './comment.validation';
import { CreateCommentRequest, UpdateCommentRequest } from './comment.types';
import { AppError } from '@/middleware/errorHandler';
import { db as prisma } from '@/shared/database';

class CommentController {
  createComment = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = validate<CreateCommentRequest>(createCommentSchema, req.body);
    const userId = parseInt(String(req.user!.id), 10);
    const comment = await commentService.createComment(userId, validatedData);

    return res.status(201).json(
      successResponse(comment, req.requestId || 'unknown', {
        message: 'Comment created successfully',
      })
    );
  });

  getComments = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const roleCode = user.role as string;

    const query = {
      contributionId: req.query.contributionId
        ? parseInt(String(req.query.contributionId), 10)
        : undefined,
      userId: req.query.userId ? parseInt(String(req.query.userId), 10) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : undefined,
    };

    if (roleCode === 'STUDENT') {
      if (!query.contributionId) {
        throw new AppError('contributionId is required', 400, 'VALIDATION_ERROR');
      }
      const contribution = await prisma.contribution.findUnique({
        where: { id: query.contributionId },
        select: { userId: true },
      });
      if (!contribution) {
        throw new AppError('Contribution not found', 404, 'NOT_FOUND');
      }
      const requesterId = parseInt(String(user.id), 10);
      if (contribution.userId !== requesterId) {
        throw new AppError('Access denied: you can only view comments on your own contributions', 403, 'FORBIDDEN');
      }
    }

    const result = await commentService.getComments(query);

    return res.json(
      successResponse(result, req.requestId || 'unknown', {
        message: 'Comments retrieved successfully',
      })
    );
  });

  getCommentById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const comment = await commentService.getCommentById(id);

    return res.json(
      successResponse(comment, req.requestId || 'unknown', {
        message: 'Comment retrieved successfully',
      })
    );
  });

  updateComment = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.user!.id), 10);
    const validatedData = validate<UpdateCommentRequest>(updateCommentSchema, req.body);
    const comment = await commentService.updateComment(id, userId, validatedData);

    return res.json(
      successResponse(comment, req.requestId || 'unknown', {
        message: 'Comment updated successfully',
      })
    );
  });

  deleteComment = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.user!.id), 10);
    await commentService.deleteComment(id, userId);

    return res.json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'Comment deleted successfully',
      })
    );
  });

  getContributionsWithoutComments = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const facultyId =
      user.role === 'COORDINATOR' ? parseInt(String(user.facultyId), 10) : undefined;

    const contributions = await commentService.getContributionsWithoutComments(facultyId);

    return res.json(
      successResponse(
        { contributions, total: contributions.length },
        req.requestId || 'unknown',
        {
          message: 'Contributions without comments retrieved successfully',
        }
      )
    );
  });

  getOverdueContributions = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    const facultyId =
      user.role === 'COORDINATOR' ? parseInt(String(user.facultyId), 10) : undefined;

    const contributions = await commentService.getOverdueContributions(facultyId);

    return res.json(
      successResponse({ contributions, total: contributions.length }, req.requestId || 'unknown', {
        message: 'Overdue contributions retrieved successfully',
      })
    );
  });
}

export default new CommentController();
