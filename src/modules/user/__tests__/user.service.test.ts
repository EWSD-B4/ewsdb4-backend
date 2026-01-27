import userService from '../user.service';
import userRepository from '../user.repository';
import cache from '@/shared/cache/redis';
import { AppError } from '@/middleware/errorHandler';

jest.mock('../user.repository');
jest.mock('@/shared/cache/redis');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    it('should return user from cache if available', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (cache.get as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));

      const result = await userService.getUserById('1');

      // Dates are serialized as strings when cached
      expect(result).toEqual({
        ...mockUser,
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(cache.get).toHaveBeenCalledWith('user:1');
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (cache.get as jest.Mock).mockResolvedValue(null);
      (userRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (cache.set as jest.Mock).mockResolvedValue(undefined);

      const result = await userService.getUserById('1');

      expect(result).toEqual(mockUser);
      expect(cache.get).toHaveBeenCalledWith('user:1');
      expect(userRepository.findById).toHaveBeenCalledWith('1');
      expect(cache.set).toHaveBeenCalledWith('user:1', JSON.stringify(mockUser), 3600);
    });

    it('should throw AppError if user not found', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);
      (userRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(userService.getUserById('999')).rejects.toThrow(AppError);
      await expect(userService.getUserById('999')).rejects.toThrow('User not found');
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const createUserDTO = {
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: createUserDTO.email,
        name: createUserDTO.name,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);
      (userRepository.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await userService.createUser(createUserDTO);

      expect(result).toEqual(mockUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith(createUserDTO.email);
      expect(userRepository.create).toHaveBeenCalledWith(createUserDTO);
    });

    it('should throw AppError if email already exists', async () => {
      const createUserDTO = {
        email: 'existing@example.com',
        name: 'Existing User',
        password: 'password123',
      };

      (userRepository.findByEmail as jest.Mock).mockResolvedValue({ id: '1' });

      await expect(userService.createUser(createUserDTO)).rejects.toThrow(AppError);
      await expect(userService.createUser(createUserDTO)).rejects.toThrow(
        'User with this email already exists'
      );
    });
  });
});
