import userRepository from '@/modules/user/user.repository';
import {
  LoginDTO,
  RegisterDTO,
  AuthResponse,
  UpdatePasswordDTO,
  ForgetPasswordDTO,
  ResetPasswordDTO,
} from './auth.types';
import { AppError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword } from '@/utils/password';
import { generateToken } from '@/utils/jwt';
import { Try } from '@/shared/utils/Try';
import cache from '@/shared/cache/redis';
import crypto from 'crypto';
import { emailService } from '@/shared/email';

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
        faculty_id: data.faculty_id ?? 1,
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
        role_id: user.role_id,
        faculty: user.faculty,
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
      role: user.role,
    });

    await cache.set(`auth:state:user:${user.id}`, 'logged_in');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        role_id: user.role_id,
        faculty: user.faculty,
      },
      token,
    };
  }

  async logout(userId: string): Promise<void> {
    await cache.set(`auth:state:user:${userId}`, 'logged_out');
  }

  async updatePassword(userId: string, data: UpdatePasswordDTO): Promise<void> {
    const userBasic = await Try.execute(() => userRepository.findById(userId)).orElseThrow(
      'Failed to find user'
    );

    if (!userBasic) {
      throw new AppError('User not found', 404);
    }

    const user = await Try.execute(() =>
      userRepository.findByEmailWithPassword(userBasic.email)
    ).orElseThrow('Failed to find user');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isCurrentPasswordValid = await comparePassword(data.currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    if (data.currentPassword === data.newPassword) {
      throw new AppError('New password must be different from current password', 400);
    }

    const hashedPassword = await hashPassword(data.newPassword);

    await Try.execute(() => userRepository.updatePassword(userId, hashedPassword)).orElseThrow(
      'Failed to update password'
    );
  }

  async forgetPassword(data: ForgetPasswordDTO): Promise<void> {
    const user = await Try.execute(() => userRepository.findByEmail(data.email)).orElseThrow(
      'Failed to check user'
    );

    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000;

    await cache.set(
      `password:reset:${resetToken}`,
      JSON.stringify({ userId: user.id, expiry: resetTokenExpiry }),
      3600
    );

    await emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
    const resetData = await cache.get(`password:reset:${token}`);

    if (!resetData) {
      return { valid: false };
    }

    const { userId, expiry } = JSON.parse(resetData);

    if (Date.now() > expiry) {
      await cache.del(`password:reset:${token}`);
      return { valid: false };
    }

    const user = await Try.execute(() => userRepository.findById(userId)).orElseThrow(
      'Failed to find user'
    );

    return {
      valid: true,
      email: user?.email,
    };
  }

  async resetPassword(data: ResetPasswordDTO): Promise<void> {
    const resetData = await cache.get(`password:reset:${data.token}`);

    if (!resetData) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    const { userId, expiry } = JSON.parse(resetData);

    if (Date.now() > expiry) {
      await cache.del(`password:reset:${data.token}`);
      throw new AppError('Reset token has expired', 400);
    }

    const hashedPassword = await hashPassword(data.newPassword);

    await Try.execute(() => userRepository.updatePassword(userId, hashedPassword)).orElseThrow(
      'Failed to reset password'
    );

    await cache.del(`password:reset:${data.token}`);
  }
}

export default new AuthService();
