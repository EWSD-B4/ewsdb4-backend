import userRepository from '@/modules/user/user.repository';
import { LoginDTO, RegisterDTO, AuthResponse } from './auth.types';
import { AppError } from '@/middleware/errorHandler';
import { hashPassword, comparePassword } from '@/utils/password';
import { generateToken } from '@/utils/jwt';

class AuthService {
  async register(data: RegisterDTO): Promise<AuthResponse> {
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await userRepository.create({
      email: data.email,
      name: data.name,
      password: hashedPassword,
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: 'user',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }

  async login(data: LoginDTO): Promise<AuthResponse> {
    const user = await userRepository.findByEmailWithPassword(data.email);
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

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    };
  }
}

export default new AuthService();
