import { Request, Response } from 'express';
import userService from './user.service';
import { asyncHandler } from '@/middleware/asyncHandler';
import { successResponse } from '@/utils/response';
import { AppError } from '@/middleware/errorHandler';
import { CreateUserDTO, UpdateUserDTO } from './user.types';

class UserController {
  getAllUsers = asyncHandler(async (_req: Request, res: Response) => {
    const users = await userService.getAllUsers();
    res
      .status(200)
      .json(successResponse(users, _req.requestId || 'unknown', { message: 'Users retrieved successfully' }));
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (req.user && req.user.role !== 'admin' && String(req.user.id) !== String(id)) {
      throw new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN');
    }
    const user = await userService.getUserById(id);
    res
      .status(200)
      .json(successResponse(user, req.requestId || 'unknown', { message: 'User retrieved successfully' }));
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body as CreateUserDTO);
    res
      .status(201)
      .json(successResponse(user, req.requestId || 'unknown', { message: 'User created successfully' }));
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await userService.updateUser(id, req.body as UpdateUserDTO);
    res
      .status(200)
      .json(successResponse(user, req.requestId || 'unknown', { message: 'User updated successfully' }));
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await userService.deleteUser(id);
    res
      .status(200)
      .json(successResponse({ success: true }, req.requestId || 'unknown', { message: 'User deleted successfully' }));
  });
}

export default new UserController();
