import userRepository from './user.repository';
import { CreateUserDTO, UpdateUserDTO, User } from './user.types';
import { AppError } from '@/middleware/errorHandler';
import cache from '@/shared/cache/redis';
import { hashPassword } from '@/utils/password';
import { Try } from '@/shared/utils/Try';
import { db } from '@/shared/database';
import { emailService } from '@/shared/email';
import notificationService from '@/modules/notification/notification.service';
import { ROLES } from '@/constants/roles';

class UserService {
  private cachePrefix = 'user:';
  private cacheTTL = 3600;

  async getAllUsers(): Promise<User[]> {
    return await Try.execute(() => userRepository.findAll()).orElseThrow(
      'Failed to retrieve users'
    );
  }

  async getUserById(id: string): Promise<User> {
    const cacheKey = `${this.cachePrefix}${id}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as User;
    }

    const user = await Try.execute(() => userRepository.findById(id)).orElseThrow(
      'Failed to retrieve user'
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    await cache.set(cacheKey, JSON.stringify(user), this.cacheTTL);
    return user;
  }

  async createUser(userData: CreateUserDTO): Promise<User> {
    const existingUser = await Try.execute(() =>
      userRepository.findByEmail(userData.email)
    ).orElseThrow('Failed to check existing user');

    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const role = await Try.execute(() =>
      db.role.findUnique({
        where: { id: userData.role_id },
        select: { roleCode: true },
      })
    ).orElseThrow('Failed to resolve user role');

    if (!role) {
      throw new AppError('Role not found', 404);
    }

    if (role.roleCode === ROLES.GUEST && userData.faculty_id) {
      const hasCoordinator = await notificationService.hasActiveCoordinatorForFaculty(
        userData.faculty_id
      );

      if (!hasCoordinator) {
        throw new AppError(
          'Guest account cannot be created because no active Marketing Coordinator exists for the selected faculty. Please create the coordinator first.',
          400,
          'COORDINATOR_REQUIRED_FOR_GUEST'
        );
      }
    }

    const plainPassword = userData.password;
    const createPayload = {
      ...userData,
      password: await hashPassword(userData.password),
    };

    const user = await Try.execute(() => userRepository.create(createPayload)).orElseThrow(
      'Failed to create user'
    );

    await Try.execute(() =>
      emailService.sendAdminCreatedAccountEmail(user.email, {
        name: user.name || user.email,
        email: user.email,
        password: plainPassword,
        role: user.role,
        facultyName: user.faculty !== 'N/A' ? user.faculty : null,
      })
    ).orElseLogWarning(`Failed to send admin-created account email to ${user.email}`);

    if (role.roleCode === ROLES.GUEST && userData.faculty_id) {
      await notificationService.notifyGuestRegistered(
        parseInt(user.id, 10),
        userData.faculty_id,
        'admin creation'
      );
    }

    return user;
  }

  async updateUser(id: string, userData: UpdateUserDTO): Promise<User> {
    const user = await Try.execute(() => userRepository.update(id, userData)).orElseThrow(
      'Failed to update user'
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const cacheKey = `${this.cachePrefix}${id}`;
    await cache.del(cacheKey);

    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const deleted = await Try.execute(() => userRepository.delete(id)).orElseThrow(
      'Failed to delete user'
    );

    if (!deleted) {
      throw new AppError('User not found', 404);
    }

    const cacheKey = `${this.cachePrefix}${id}`;
    await cache.del(cacheKey);
  }
}

export default new UserService();
