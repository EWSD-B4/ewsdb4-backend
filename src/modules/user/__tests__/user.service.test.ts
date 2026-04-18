import userService from '../user.service';
import userRepository from '../user.repository';
import cache from '@/shared/cache/redis';
import { AppError } from '@/middleware/errorHandler';
import { db } from '@/shared/database';
import { emailService } from '@/shared/email';
import notificationService from '@/modules/notification/notification.service';

jest.mock('../user.repository');
jest.mock('@/shared/cache/redis');
jest.mock('@/shared/database', () => ({
  db: {
    role: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('@/shared/email', () => ({
  emailService: {
    sendAdminCreatedAccountEmail: jest.fn(),
  },
}));
jest.mock('@/modules/notification/notification.service', () => ({
  __esModule: true,
  default: {
    hasActiveCoordinatorForFaculty: jest.fn(),
    notifyGuestRegistered: jest.fn(),
  },
}));

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
        role_id: 1,
        faculty_id: 1,
      };

      const mockUser = {
        id: '1',
        email: createUserDTO.email,
        name: createUserDTO.name,
        role: 'MANAGER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);
      (db.role.findUnique as jest.Mock).mockResolvedValue({ roleCode: 'MANAGER' });
      (userRepository.create as jest.Mock).mockResolvedValue(mockUser);
      (emailService.sendAdminCreatedAccountEmail as jest.Mock).mockResolvedValue(undefined);

      const result = await userService.createUser(createUserDTO);

      expect(result).toEqual(mockUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith(createUserDTO.email);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createUserDTO.email,
          name: createUserDTO.name,
          role_id: createUserDTO.role_id,
          faculty_id: createUserDTO.faculty_id,
        })
      );
      expect(emailService.sendAdminCreatedAccountEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.objectContaining({
          email: mockUser.email,
          password: createUserDTO.password,
          role: mockUser.role,
        })
      );
    });

    it('should throw AppError if email already exists', async () => {
      const createUserDTO = {
        email: 'existing@example.com',
        name: 'Existing User',
        password: 'password123',
        role_id: 1,
      };

      (userRepository.findByEmail as jest.Mock).mockResolvedValue({ id: '1' });

      await expect(userService.createUser(createUserDTO)).rejects.toThrow(AppError);
      await expect(userService.createUser(createUserDTO)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should reject guest creation when no coordinator exists for the faculty', async () => {
      const createUserDTO = {
        email: 'guest@example.com',
        name: 'Guest User',
        password: 'password123',
        role_id: 5,
        faculty_id: 2,
      };

      (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);
      (db.role.findUnique as jest.Mock).mockResolvedValue({ roleCode: 'GUEST' });
      (notificationService.hasActiveCoordinatorForFaculty as jest.Mock).mockResolvedValue(false);

      await expect(userService.createUser(createUserDTO)).rejects.toThrow(AppError);
      await expect(userService.createUser(createUserDTO)).rejects.toThrow(
        'Guest account cannot be created because no active Marketing Coordinator exists for the selected faculty. Please create the coordinator first.'
      );
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });
});
