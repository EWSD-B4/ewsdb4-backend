import { Request, Response } from 'express';
import userService from './user.service';
import { asyncHandler } from '@/middleware/asyncHandler';
import { ApiResponse } from '@/types/common';
import { User } from './user.types';

class UserController {
  getAllUsers = asyncHandler(async (_req: Request, res: Response) => {
    const users = await userService.getAllUsers();

    const response: ApiResponse<User[]> = {
      success: true,
      message: 'Users retrieved successfully',
      data: users,
    };

    res.status(200).json(response);
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await userService.getUserById(id);

    const response: ApiResponse<User> = {
      success: true,
      message: 'User retrieved successfully',
      data: user,
    };

    res.status(200).json(response);
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body);

    const response: ApiResponse<User> = {
      success: true,
      message: 'User created successfully',
      data: user,
    };

    res.status(201).json(response);
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await userService.updateUser(id, req.body);

    const response: ApiResponse<User> = {
      success: true,
      message: 'User updated successfully',
      data: user,
    };

    res.status(200).json(response);
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await userService.deleteUser(id);

    const response: ApiResponse = {
      success: true,
      message: 'User deleted successfully',
    };

    res.status(200).json(response);
  });
}

export default new UserController();
