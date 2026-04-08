import { db } from '@/shared/database';
import { User, CreateUserDTO, UpdateUserDTO } from './user.types';

class UserRepository {
  async findAll(): Promise<User[]> {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        isActive: true,
        updatedAt: true,
        role: {
          select: {
            id: true,
            roleCode: true,
          },
        },
        faculty: {
          select: {
            facultyName: true,
          },
        },
      },
    });

    return users.map((user) => ({
      id: user.id.toString(),
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      is_active: user.isActive,
      role: user.role.roleCode,
      role_id: user.role.id,
      faculty: user.faculty?.facultyName || 'N/A',
    }));
  }

  async findById(id: string): Promise<User | null> {
    const user = await db.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        role: {
          select: {
            id: true,
            roleCode: true,
          },
        },
        faculty: {
          select: {
            facultyName: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id.toString(),
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      is_active: user.isActive,
      role: user.role.roleCode,
      role_id: user.role.id,
      faculty: user.faculty?.facultyName || 'N/A',
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        role: {
          select: {
            id: true,
            roleCode: true,
          },
        },
        faculty: {
          select: {
            facultyName: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id.toString(),
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      is_active: user.isActive,
      role: user.role.roleCode,
      role_id: user.role.id,
      faculty: user.faculty?.facultyName || 'N/A',
    };
  }

  async findByEmailWithPassword(email: string): Promise<(User & { password: string }) | null> {
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        role: {
          select: {
            id: true,
            roleCode: true,
          },
        },
        faculty: {
          select: {
            id: true,
            facultyName: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id.toString(),
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      password: user.passwordHash,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      is_active: user.isActive,
      role: user.role.roleCode,
      role_id: user.role.id,
      faculty: user.faculty?.facultyName || 'N/A',
      faculty_id: user.faculty?.id,
    };
  }

  async create(userData: CreateUserDTO): Promise<User> {
    const [firstName, ...lastNameParts] = (userData.name || '').split(' ');
    const lastName = lastNameParts.join(' ');

    const user = await db.user.create({
      data: {
        email: userData.email,
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash: userData.password,
        roleId: userData.role_id,
        facultyId: userData.faculty_id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        role: {
          select: {
            id: true,
            roleCode: true,
          },
        },
        faculty: {
          select: {
            facultyName: true,
          },
        },
      },
    });

    return {
      id: user.id.toString(),
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      is_active: user.isActive,
      role: user.role.roleCode,
      role_id: user.role.id,
      faculty: user.faculty?.facultyName || 'N/A',
    };
  }

  async update(id: string, userData: UpdateUserDTO): Promise<User | null> {
    const updateData: {
      firstName?: string;
      lastName?: string | null;
      email?: string;
      lastLogin?: Date;
    } = {};

    if (userData.name) {
      const [firstName, ...lastNameParts] = userData.name.split(' ');
      updateData.firstName = firstName;
      updateData.lastName = lastNameParts.join(' ') || null;
    }

    if (userData.email) {
      updateData.email = userData.email;
    }

    if (userData.last_login) {
      updateData.lastLogin = userData.last_login;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    const user = await db.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        isActive: true,
        role: {
          select: {
            id: true,
            roleCode: true,
          },
        },
        faculty: {
          select: {
            facultyName: true,
          },
        },
      },
    });

    return {
      id: user.id.toString(),
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      is_active: user.isActive,
      role: user.role.roleCode,
      role_id: user.role.id,
      faculty: user.faculty?.facultyName || 'N/A',
    };
  }

  async delete(id: string): Promise<boolean> {
    try {
      await db.user.delete({
        where: { id: parseInt(id) },
      });
      return true;
    } catch {
      return false;
    }
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await db.user.update({
      where: { id: parseInt(userId) },
      data: {
        passwordHash: newPasswordHash,
      },
    });
  }
}

export default new UserRepository();
