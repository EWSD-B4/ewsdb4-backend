import userRepository from '@/modules/user/user.repository';
import { LoginDTO, RegisterDTO, AuthResponse } from './auth.types';
import { AppError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword } from '@/utils/password';
import { generateToken } from '@/utils/jwt';
import { Try } from '@/shared/utils/Try';
import cache from '@/shared/cache/redis';

class AuthService {
  async register(data: RegisterDTO): Promise<AuthResponse> {
    const existingUser = await Try.execute(() =>
      userRepository.findByEmail(data.email)
    ).orElseThrow('Failed to check existing user');

    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await Try.execute(() =>
      userRepository.create({
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role_id: data.role_id ?? 1,
      })
    ).orElseThrow('Failed to create user');

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await cache.set(`auth:state:user:${user.id}`, 'logged_in');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    const user = await Try.execute(() =>
      userRepository.findByEmailWithPassword(data.email)
    ).orElseThrow('Failed to authenticate user');

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await comparePassword(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: 'user',
    });

    await cache.set(`auth:state:user:${user.id}`, 'logged_in');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  async logout(userId: string): Promise<void> {
    await cache.set(`auth:state:user:${userId}`, 'logged_out');
  }
}

export default new AuthService();
