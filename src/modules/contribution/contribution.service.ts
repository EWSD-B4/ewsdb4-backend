import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';

class ContributionService {
  private parseContributionId(id: string): number {
    const idNum = parseInt(id, 10);
    if (!Number.isFinite(idNum)) {
      throw new BadRequestError('Invalid contribution id');
    }
    return idNum;
  }

  async listCoordinatorContributions(facultyId: number, limit: number, offset: number) {
    const where = { facultyId };
    const [items, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contribution.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getCoordinatorContribution(facultyId: number, id: string) {
    const contributionId = this.parseContributionId(id);
    const contribution = await prisma.contribution.findFirst({
      where: { id: contributionId, facultyId },
    });
    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }
    return contribution;
  }

  async listGuestSelected(facultyId: number, limit: number, offset: number) {
    const where = { facultyId, status: 'selected' };
    const [items, total] = await Promise.all([
      prisma.contribution.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contribution.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getGuestSelected(id: string) {
    const contributionId = this.parseContributionId(id);
    const contribution = await prisma.contribution.findFirst({
      where: { id: contributionId, status: 'selected' },
    });
    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }
    return contribution;
  }
}

export default new ContributionService();
