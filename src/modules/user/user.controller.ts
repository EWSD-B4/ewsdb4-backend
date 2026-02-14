import { Request, Response } from 'express';
import userService from './user.service';
import { asyncHandler } from '@/middleware/asyncHandler';
import { successResponse } from '@/utils/response';

class UserController {
  getAllUsers = asyncHandler(async (_req: Request, res: Response) => {
    const users = await userService.getAllUsers();
    res.status(200).json(successResponse('Users retrieved successfully', users));
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await userService.getUserById(id);
    res.status(200).json(successResponse('User retrieved successfully', user));
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body);
    res.status(201).json(successResponse('User created successfully', user));
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await userService.updateUser(id, req.body);
    res.status(200).json(successResponse('User updated successfully', user));
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await userService.deleteUser(id);
    res.status(200).json(successResponse('User deleted successfully'));
  });
}

export default new UserController();
