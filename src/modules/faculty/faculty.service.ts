import prisma from '@/shared/database/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/AppError';
import { FacultyListQuery } from './faculty.types';

class FacultyService {
  private parseFacultyId(id: string): number {
    const idNum = parseInt(id, 10);
    if (!Number.isFinite(idNum)) {
      throw new BadRequestError('Invalid faculty id');
    }
    return idNum;
  }

  async createFaculty(data: { code: string; name: string }) {
    const existing = await prisma.faculty.findFirst({
      where: {
        OR: [{ facultyCode: data.code }, { facultyName: data.name }],
      },
    });
    if (existing) {
      throw new ConflictError('Faculty code or name already exists');
    }

    return prisma.faculty.create({
      data: {
        facultyCode: data.code,
        facultyName: data.name,
      },
    });
  }

  async listFaculties(query: FacultyListQuery) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { facultyCode: { contains: query.search } },
        { facultyName: { contains: query.search } },
      ];
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [items, total] = await Promise.all([
      prisma.faculty.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { facultyName: 'asc' },
      }),
      prisma.faculty.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async updateFaculty(id: string, data: { code?: string; name?: string; isActive?: boolean }) {
    const idNum = this.parseFacultyId(id);
    const faculty = await prisma.faculty.findUnique({ where: { id: idNum } });
    if (!faculty) {
      throw new NotFoundError('Faculty not found');
    }

    if (data.code || data.name) {
      const existing = await prisma.faculty.findFirst({
        where: {
          id: { not: idNum },
          OR: [
            ...(data.code ? [{ facultyCode: data.code }] : []),
            ...(data.name ? [{ facultyName: data.name }] : []),
          ],
        },
      });
      if (existing) {
        throw new ConflictError('Faculty code or name already exists');
      }
    }

    return prisma.faculty.update({
      where: { id: idNum },
      data: {
        ...(data.code ? { facultyCode: data.code } : {}),
        ...(data.name ? { facultyName: data.name } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deactivateFaculty(id: string) {
    const idNum = this.parseFacultyId(id);
    const faculty = await prisma.faculty.findUnique({ where: { id: idNum } });
    if (!faculty) {
      throw new NotFoundError('Faculty not found');
    }
    return prisma.faculty.update({ where: { id: idNum }, data: { isActive: false } });
  }
}

export default new FacultyService();
