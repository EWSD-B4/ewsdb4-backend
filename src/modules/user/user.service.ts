import userRepository from './user.repository';
import { User, CreateUserDTO, UpdateUserDTO } from './user.types';
import { AppError } from '@/middleware/errorHandler';
import cache from '@/shared/cache/redis';

class UserService {
  private cachePrefix = 'user:';
  private cacheTTL = 3600;

  async getAllUsers(): Promise<User[]> {
    return await userRepository.findAll();
  }

  async getUserById(id: string): Promise<User> {
    const cacheKey = `${this.cachePrefix}${id}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as User;
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    await cache.set(cacheKey, JSON.stringify(user), this.cacheTTL);
    return user;
  }

  async createUser(userData: CreateUserDTO): Promise<User> {
    const existingUser = await userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    return await userRepository.create(userData);
  }

  async updateUser(id: string, userData: UpdateUserDTO): Promise<User> {
    const user = await userRepository.update(id, userData);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const cacheKey = `${this.cachePrefix}${id}`;
    await cache.del(cacheKey);

    return user;
  }

  async deleteUser(id: string): Promise<void> {
    const deleted = await userRepository.delete(id);
    if (!deleted) {
      throw new AppError('User not found', 404);
    }

    const cacheKey = `${this.cachePrefix}${id}`;
    await cache.del(cacheKey);
  }
}

export default new UserService();
