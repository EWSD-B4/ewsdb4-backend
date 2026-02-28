import prisma from '@/shared/database/prisma';
import { NotFoundError } from '@/shared/errors/AppError';

class ContributionService {
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
    const contribution = await prisma.contribution.findFirst({
      where: { id: parseInt(id, 10), facultyId },
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
    const contribution = await prisma.contribution.findFirst({
      where: { id: parseInt(id, 10), status: 'selected' },
    });
    if (!contribution) {
      throw new NotFoundError('Contribution not found');
    }
    return contribution;
  }
}

export default new ContributionService();
