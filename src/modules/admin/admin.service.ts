import prisma from '@/shared/database/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/AppError';

const rolesRequiringFaculty = new Set(['student', 'coordinator']);

class AdminService {
  async assignUserFaculty(userId: string, facultyId: string | null) {
    const userIdNum = parseInt(userId, 10);
    if (!Number.isFinite(userIdNum)) {
      throw new BadRequestError('Invalid user id');
    }

    const user = await prisma.user.findUnique({
      where: { id: userIdNum },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (rolesRequiringFaculty.has(user.role.roleCode) && !facultyId) {
      throw new BadRequestError('This role requires a faculty assignment');
    }

    if (facultyId) {
      const facultyIdNum = parseInt(facultyId, 10);
      if (!Number.isFinite(facultyIdNum)) {
        throw new BadRequestError('Invalid faculty id');
      }

      const faculty = await prisma.faculty.findUnique({ where: { id: facultyIdNum } });
      if (!faculty || !faculty.isActive) {
        throw new BadRequestError('Invalid faculty');
      }
    }

    if (facultyId && user.facultyId && user.facultyId !== parseInt(facultyId, 10)) {
      const contributions = await prisma.contribution.count({ where: { userId: userIdNum } });
      if (contributions > 0) {
        throw new ConflictError('Cannot change faculty: user has contributions');
      }
    }

    return prisma.user.update({
      where: { id: userIdNum },
      data: { facultyId: facultyId ? parseInt(facultyId, 10) : null },
      select: {
        id: true,
        roleId: true,
        email: true,
        firstName: true,
        lastName: true,
        facultyId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });
  }

  async listUsersByFaculty(
    facultyId: string,
    roleCode?: string,
    limit: number = 20,
    offset: number = 0
  ) {
    const facultyIdNum = parseInt(facultyId, 10);
    if (!Number.isFinite(facultyIdNum)) {
      throw new BadRequestError('Invalid faculty id');
    }

    const faculty = await prisma.faculty.findUnique({ where: { id: facultyIdNum } });
    if (!faculty) {
      throw new NotFoundError('Faculty not found');
    }

    const where: any = { facultyId: facultyIdNum };
    if (roleCode) {
      where.role = { roleCode };
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where: { ...where, facultyId: facultyIdNum },
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          roleId: true,
          email: true,
          firstName: true,
          lastName: true,
          facultyId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
        },
      }),
      prisma.user.count({ where: { ...where, facultyId: facultyIdNum } }),
    ]);

    return { items, total, limit, offset };
  }
}

export default new AdminService();
