import { db } from '@/shared/database';
import logger from '@/shared/logger';
import { Try } from '@/shared/utils/Try';
import { SubmissionHistoryResponse, HistoryQuery } from './history.types';

class HistoryService {
  async createHistoryEntry(
    contributionId: number,
    userId: number,
    action: string,
    note?: string
  ): Promise<SubmissionHistoryResponse> {
    return Try.execute(async () => {
      const history = await db.submissionHistory.create({
        data: {
          contributionId,
          userId,
          action,
          note: note || null,
          actionDate: new Date(),
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

      logger.info(`History entry created: ${action} on contribution ${contributionId}`);

      return this.formatHistory(history);
    }).orElseThrow('Error creating history entry');
  }

  async getHistory(query: HistoryQuery): Promise<{
    history: SubmissionHistoryResponse[];
    total: number;
    limit: number;
    offset: number;
  }> {
    return Try.execute(async () => {
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const where: any = {};

      if (query.contributionId) where.contributionId = query.contributionId;
      if (query.userId) where.userId = query.userId;
      if (query.action) where.action = query.action;
      if (query.startDate || query.endDate) {
        where.actionDate = {};
        if (query.startDate) where.actionDate.gte = new Date(query.startDate);
        if (query.endDate) where.actionDate.lte = new Date(query.endDate);
      }

      const [history, total] = await Promise.all([
        db.submissionHistory.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { actionDate: 'desc' },
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
        db.submissionHistory.count({ where }),
      ]);

      return {
        history: history.map((h) => this.formatHistory(h)),
        total,
        limit,
        offset,
      };
    }).orElseThrow('Error fetching history');
  }

  async getContributionHistory(contributionId: number): Promise<SubmissionHistoryResponse[]> {
    return Try.execute(async () => {
      const history = await db.submissionHistory.findMany({
        where: { contributionId },
        orderBy: { actionDate: 'asc' },
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

      return history.map((h) => this.formatHistory(h));
    }).orElseThrow('Error fetching contribution history');
  }

  async getUserActivityHistory(
    userId: number,
    limit = 50
  ): Promise<SubmissionHistoryResponse[]> {
    return Try.execute(async () => {
      const history = await db.submissionHistory.findMany({
        where: { userId },
        take: limit,
        orderBy: { actionDate: 'desc' },
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

      return history.map((h) => this.formatHistory(h));
    }).orElseThrow('Error fetching user activity history');
  }

  async getAuditTrail(startDate: Date, endDate: Date): Promise<SubmissionHistoryResponse[]> {
    return Try.execute(async () => {
      const history = await db.submissionHistory.findMany({
        where: {
          actionDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { actionDate: 'desc' },
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

      return history.map((h) => this.formatHistory(h));
    }).orElseThrow('Error fetching audit trail');
  }

  private formatHistory(history: any): SubmissionHistoryResponse {
    return {
      id: history.id,
      contributionId: history.contributionId,
      userId: history.userId,
      action: history.action,
      note: history.note,
      actionDate: history.actionDate.toISOString(),
      createdAt: history.createdAt.toISOString(),
      user: history.user,
    };
  }
}

export default new HistoryService();
