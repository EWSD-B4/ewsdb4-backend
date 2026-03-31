import { db } from '@/shared/database';
import logger from '@/shared/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '@/shared/errors/AppError';
import { Try } from '@/shared/utils/Try';
import academicYearService from '@/modules/academic-year/academic-year.service';
import {
  ContributionResponse,
  CreateContributionRequest,
  UpdateContributionRequest,
  ContributionListQuery,
  ContributionStatus,
} from './contribution.types';

class ContributionFullService {
  async createContribution(
    userId: number,
    data: CreateContributionRequest
  ): Promise<ContributionResponse> {
    return Try.execute(async () => {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { faculty: true },
      });

      if (!user || !user.facultyId) {
        throw new BadRequestError('User must belong to a faculty');
      }

      const academicYear = await db.academicYear.findUnique({
        where: { id: data.academicYearId },
      });

      if (!academicYear || !academicYear.isActive) {
        throw new BadRequestError('Invalid or inactive academic year');
      }

      const canSubmit = await academicYearService.checkSubmissionAllowed(data.academicYearId);
      if (!canSubmit) {
        throw new BadRequestError('Submission deadline has passed for this academic year');
      }

      const contribution = await db.contribution.create({
        data: {
          userId,
          academicYearId: data.academicYearId,
          facultyId: user.facultyId,
          title: data.title,
          status: ContributionStatus.DRAFT,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          academicYear: { select: { id: true, yearName: true } },
          faculty: { select: { id: true, facultyName: true, facultyCode: true } },
        },
      });

      logger.info(`Contribution created: ${contribution.id} by user ${userId}`);

      return this.formatContribution(contribution);
    }).orElseThrow('Error creating contribution');
  }

  async getContributions(query: ContributionListQuery): Promise<{
    contributions: ContributionResponse[];
    total: number;
    limit: number;
    offset: number;
  }> {
    return Try.execute(async () => {
      const limit = query.limit ?? 20;
      const offset = query.offset ?? 0;

      const where: any = {};

      if (query.status) where.status = query.status;
      if (query.academicYearId) where.academicYearId = query.academicYearId;
      if (query.facultyId) where.facultyId = query.facultyId;
      if (query.userId) where.userId = query.userId;
      if (query.search) {
        where.OR = [{ title: { contains: query.search } }];
      }

      const [contributions, total] = await Promise.all([
        db.contribution.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            academicYear: { select: { id: true, yearName: true } },
            faculty: { select: { id: true, facultyName: true, facultyCode: true } },
            _count: { select: { comments: true } },
          },
        }),
        db.contribution.count({ where }),
      ]);

      return {
        contributions: contributions.map((c) => this.formatContribution(c)),
        total,
        limit,
        offset,
      };
    }).orElseThrow('Error fetching contributions');
  }

  async getContributionById(id: number, userId?: number): Promise<ContributionResponse> {
    return Try.execute(async () => {
      const contribution = await db.contribution.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          academicYear: { select: { id: true, yearName: true } },
          faculty: { select: { id: true, facultyName: true, facultyCode: true } },
          files: {
            select: {
              id: true,
              fileType: true,
              originalName: true,
              filePath: true,
              fileSize: true,
            },
          },
          _count: { select: { comments: true } },
        },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      if (userId && contribution.userId !== userId) {
        const user = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
        if (user?.role.roleCode === 'STUDENT') {
          throw new ForbiddenError('You can only view your own contributions');
        }
      }

      return this.formatContribution(contribution);
    }).orElseThrow('Error fetching contribution');
  }

  async updateContribution(
    id: number,
    userId: number,
    data: UpdateContributionRequest
  ): Promise<ContributionResponse> {
    return Try.execute(async () => {
      const contribution = await db.contribution.findUnique({
        where: { id },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      if (contribution.userId !== userId) {
        throw new ForbiddenError('You can only update your own contributions');
      }

      if (contribution.status !== ContributionStatus.DRAFT) {
        const canUpdate = await academicYearService.checkUpdateAllowed(
          contribution.academicYearId
        );
        if (!canUpdate) {
          throw new BadRequestError('Update deadline has passed for this contribution');
        }
      }

      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;

      const updated = await db.contribution.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          academicYear: { select: { id: true, yearName: true } },
          faculty: { select: { id: true, facultyName: true, facultyCode: true } },
        },
      });

      logger.info(`Contribution updated: ${id} by user ${userId}`);

      return this.formatContribution(updated);
    }).orElseThrow('Error updating contribution');
  }

  async submitContribution(
    id: number,
    userId: number,
    termsId: number,
    ipAddress?: string
  ): Promise<ContributionResponse> {
    return Try.execute(async () => {
      const contribution = await db.contribution.findUnique({
        where: { id },
        include: { files: true },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      if (contribution.userId !== userId) {
        throw new ForbiddenError('You can only submit your own contributions');
      }

      if (contribution.status !== ContributionStatus.DRAFT) {
        throw new BadRequestError('Contribution has already been submitted');
      }

      const hasDocx = contribution.files.some((f: any) => f.fileType === 'docx');
      if (!hasDocx) {
        throw new BadRequestError('Contribution must have at least one DOCX file');
      }

      const canSubmit = await academicYearService.checkSubmissionAllowed(
        contribution.academicYearId
      );
      if (!canSubmit) {
        throw new BadRequestError('Submission deadline has passed');
      }

      const terms = await db.termsCondition.findUnique({ where: { id: termsId } });
      if (!terms || !terms.isActive) {
        throw new BadRequestError('Invalid or inactive terms and conditions');
      }

      const [updated] = await db.$transaction([
        db.contribution.update({
          where: { id },
          data: {
            status: ContributionStatus.SUBMITTED,
            submittedAt: new Date(),
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            academicYear: { select: { id: true, yearName: true } },
            faculty: { select: { id: true, facultyName: true, facultyCode: true } },
          },
        }),
        db.agreement.create({
          data: {
            userId,
            contributionId: id,
            termsId,
            ipAddress: ipAddress || null,
            agreeAt: new Date(),
          },
        }),
        db.submissionHistory.create({
          data: {
            contributionId: id,
            userId,
            action: 'submitted',
            actionDate: new Date(),
          },
        }),
      ]);

      logger.info(`Contribution submitted: ${id} by user ${userId}`);

      return this.formatContribution(updated);
    }).orElseThrow('Error submitting contribution');
  }

  async selectContribution(
    id: number,
    coordinatorId: number,
    selected: boolean
  ): Promise<ContributionResponse> {
    return Try.execute(async () => {
      const contribution = await db.contribution.findUnique({
        where: { id },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      const coordinator = await db.user.findUnique({
        where: { id: coordinatorId },
        include: { role: true },
      });

      if (coordinator?.role.roleCode !== 'COORDINATOR') {
        throw new ForbiddenError('Only coordinators can select contributions');
      }

      if (coordinator.facultyId !== contribution.facultyId) {
        throw new ForbiddenError('You can only select contributions from your faculty');
      }

      const newStatus = selected ? ContributionStatus.SELECTED : ContributionStatus.REJECTED;

      const [updated] = await db.$transaction([
        db.contribution.update({
          where: { id },
          data: {
            status: newStatus,
            publishedAt: selected ? new Date() : null,
          },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            academicYear: { select: { id: true, yearName: true } },
            faculty: { select: { id: true, facultyName: true, facultyCode: true } },
          },
        }),
        db.submissionHistory.create({
          data: {
            contributionId: id,
            userId: coordinatorId,
            action: selected ? 'selected' : 'rejected',
            actionDate: new Date(),
          },
        }),
      ]);

      logger.info(`Contribution ${selected ? 'selected' : 'rejected'}: ${id} by ${coordinatorId}`);

      return this.formatContribution(updated);
    }).orElseThrow('Error selecting contribution');
  }

  async deleteContribution(id: number, userId: number): Promise<void> {
    return Try.execute(async () => {
      const contribution = await db.contribution.findUnique({
        where: { id },
      });

      if (!contribution) {
        throw new NotFoundError('Contribution not found');
      }

      if (contribution.userId !== userId) {
        throw new ForbiddenError('You can only delete your own contributions');
      }

      if (contribution.status !== ContributionStatus.DRAFT) {
        throw new BadRequestError('Only draft contributions can be deleted');
      }

      await db.contribution.delete({ where: { id } });

      logger.info(`Contribution deleted: ${id} by user ${userId}`);
    }).orElseThrow('Error deleting contribution');
  }

  private formatContribution(contribution: any): ContributionResponse {
    return {
      id: contribution.id,
      userId: contribution.userId,
      academicYearId: contribution.academicYearId,
      facultyId: contribution.facultyId,
      title: contribution.title,
      status: contribution.status,
      submittedAt: contribution.submittedAt ? contribution.submittedAt.toISOString() : null,
      publishedAt: contribution.publishedAt ? contribution.publishedAt.toISOString() : null,
      createdAt: contribution.createdAt.toISOString(),
      updatedAt: contribution.updatedAt.toISOString(),
      user: contribution.user,
      academicYear: contribution.academicYear,
      faculty: contribution.faculty,
      files: contribution.files,
      commentsCount: contribution._count?.comments,
    };
  }
}

export default new ContributionFullService();
