import { db } from '@/shared/database';
import logger from '@/shared/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '@/shared/errors/AppError';
import { Try } from '@/shared/utils/Try';
import {
  CommentResponse,
  CreateCommentRequest,
  UpdateCommentRequest,
  CommentListQuery,
} from './comment.types';

class CommentService {
  async createComment(userId: number, data: CreateCommentRequest): Promise<CommentResponse> {
    return Try.execute(async () => {
      const contribution = await db.contribution.findUnique({
        where: { id: data.contributionId },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      if (contribution.status === 'draft') {
        throw new BadRequestError('Cannot comment on draft contributions');
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const isCoordinator = user.role.roleCode === 'COORDINATOR';
      const isOwner = contribution.userId === userId;

      if (!isCoordinator && !isOwner) {
        throw new ForbiddenError('Only coordinators and contribution owners can comment');
      }

      if (isCoordinator && user.facultyId !== contribution.facultyId) {
        throw new ForbiddenError('You can only comment on contributions from your faculty');
      }

      if (isCoordinator && contribution.commentDueDate && new Date() > contribution.commentDueDate) {
        throw new BadRequestError(`Comment deadline has passed for this contribution. Due date was ${contribution.commentDueDate.toISOString().split('T')[0]}`);
      }

      const comment = await db.comment.create({
        data: {
          contributionId: data.contributionId,
          userId,
          content: data.content,
          commentedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: { select: { roleCode: true, roleName: true } },
            },
          },
        },
      });

      logger.info(`Comment created on contribution ${data.contributionId} by user ${userId}`);

      return this.formatComment(comment);
    }).orElseThrow('Error creating comment');
  }

  async getComments(query: CommentListQuery): Promise<{
    comments: CommentResponse[];
    total: number;
    limit: number;
    offset: number;
  }> {
    return Try.execute(async () => {
      const limit = query.limit ?? 20;
      const offset = query.offset ?? 0;

      const where: any = {};

      if (query.contributionId) where.contributionId = query.contributionId;
      if (query.userId) where.userId = query.userId;

      const [comments, total] = await Promise.all([
        db.comment.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { commentedAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: { select: { roleCode: true, roleName: true } },
              },
            },
          },
        }),
        db.comment.count({ where }),
      ]);

      return {
        comments: comments.map((c) => this.formatComment(c)),
        total,
        limit,
        offset,
      };
    }).orElseThrow('Error fetching comments');
  }

  async getCommentById(id: number): Promise<CommentResponse> {
    return Try.execute(async () => {
      const comment = await db.comment.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: { select: { roleCode: true, roleName: true } },
            },
          },
        },
      });

      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      return this.formatComment(comment);
    }).orElseThrow('Error fetching comment');
  }

  async updateComment(
    id: number,
    userId: number,
    data: UpdateCommentRequest
  ): Promise<CommentResponse> {
    return Try.execute(async () => {
      const comment = await db.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      if (comment.userId !== userId) {
        throw new ForbiddenError('You can only update your own comments');
      }

      const updated = await db.comment.update({
        where: { id },
        data: {
          content: data.content,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: { select: { roleCode: true, roleName: true } },
            },
          },
        },
      });

      logger.info(`Comment updated: ${id} by user ${userId}`);

      return this.formatComment(updated);
    }).orElseThrow('Error updating comment');
  }

  async deleteComment(id: number, userId: number): Promise<void> {
    return Try.execute(async () => {
      const comment = await db.comment.findUnique({
        where: { id },
      });

      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });

      const isAdmin = user?.role.roleCode === 'ADMIN';
      const isOwner = comment.userId === userId;

      if (!isAdmin && !isOwner) {
        throw new ForbiddenError('You can only delete your own comments');
      }

      await db.comment.delete({ where: { id } });

      logger.info(`Comment deleted: ${id} by user ${userId}`);
    }).orElseThrow('Error deleting comment');
  }

  async getContributionsWithoutComments(facultyId?: number): Promise<any[]> {
    return Try.execute(async () => {
      const where: any = {
        status: 'submitted',
      };

      if (facultyId) {
        where.facultyId = facultyId;
      }

      const contributions = await db.contribution.findMany({
        where,
        include: {
          _count: { select: { comments: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          faculty: { select: { id: true, facultyName: true } },
        },
      });

      return contributions
        .filter((c) => c._count.comments === 0)
        .map((c) => ({
          id: c.id,
          title: c.title,
          submittedAt: c.submittedAt?.toISOString(),
          user: c.user,
          faculty: c.faculty,
          daysSinceSubmission: c.submittedAt
            ? Math.floor((Date.now() - c.submittedAt.getTime()) / (1000 * 60 * 60 * 24))
            : 0,
        }));
    }).orElseThrow('Error fetching contributions without comments');
  }

  async getOverdueContributions(facultyId?: number): Promise<any[]> {
    return Try.execute(async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const where: any = {
        status: 'submitted',
        submittedAt: { lt: fourteenDaysAgo },
      };

      if (facultyId) {
        where.facultyId = facultyId;
      }

      const contributions = await db.contribution.findMany({
        where,
        include: {
          _count: { select: { comments: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          faculty: { select: { id: true, facultyName: true } },
        },
      });

      return contributions
        .filter((c) => c._count.comments === 0)
        .map((c) => ({
          id: c.id,
          title: c.title,
          submittedAt: c.submittedAt?.toISOString(),
          user: c.user,
          faculty: c.faculty,
          daysOverdue: c.submittedAt
            ? Math.floor((Date.now() - c.submittedAt.getTime()) / (1000 * 60 * 60 * 24)) - 14
            : 0,
        }));
    }).orElseThrow('Error fetching overdue contributions');
  }

  private formatComment(comment: any): CommentResponse {
    const formattedUser = comment.user ? {
      name: `${comment.user.firstName || ''}${comment.user.firstName && comment.user.lastName ? ' ' : ''}${comment.user.lastName || ''}`.trim() || comment.user.email,
      role: comment.user.role?.roleName || '',
    } : undefined;

    return {
      id: comment.id,
      contributionId: comment.contributionId,
      content: comment.content,
      commentedAt: comment.commentedAt ? comment.commentedAt.toISOString() : null,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      user: formattedUser,
    };
  }
}

export default new CommentService();
