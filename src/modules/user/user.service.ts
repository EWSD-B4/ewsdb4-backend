import userRepository from './user.repository';
import { CreateUserDTO, UpdateUserDTO, User } from './user.types';
import { AppError } from '@/middleware/errorHandler';
import cache from '@/shared/cache/redis';
import { hashPassword } from '@/utils/password';
import { Try } from '@/shared/utils/Try';

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

    userData.role_id = 1;
    userData.password = await hashPassword(userData.password);
    return await Try.execute(() => userRepository.create(userData)).orElseThrow(
      'Failed to create user'
    );
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
