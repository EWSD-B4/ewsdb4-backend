import { db as prisma } from '@/shared/database';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/AppError';
import { Prisma } from '@prisma/client';
import { ROLES } from '@/constants/roles';

const rolesRequiringFaculty = new Set<string>([ROLES.STUDENT, ROLES.COORDINATOR]);

class AdminService {
  async getAllRoles() {
    return prisma.role.findMany({
      orderBy: { id: 'asc' },
    });
  }

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

    if (rolesRequiringFaculty.has(String(user.role.roleCode).toUpperCase()) && !facultyId) {
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

  async listGuests(facultyId?: number, limit: number = 20, offset: number = 0) {
    const where: Prisma.UserWhereInput = { role: { roleCode: ROLES.GUEST } };
    if (facultyId) {
      where.facultyId = facultyId;
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          facultyId: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          faculty: { select: { facultyName: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, limit, offset };
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

    const where: Prisma.UserWhereInput = { facultyId: facultyIdNum };
    if (roleCode) {
      where.role = { roleCode: roleCode.toUpperCase() };
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
      prisma.user.count({ where }),
    ]);

    return { items, total, limit, offset };
  }
}

export default new AdminService();
