import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import adminService from './admin.service';
import { successResponse } from '@/utils/response';

class AdminController {
  getAllRoles = asyncHandler(async (req: Request, res: Response) => {
    const roles = await adminService.getAllRoles();
    res.json(
      successResponse(roles, req.requestId || 'unknown', { message: 'Roles retrieved' })
    );
  });

  assignUserFaculty = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { facultyId?: string | number | null };
    const facultyId =
      body.facultyId === null || body.facultyId === undefined ? null : String(body.facultyId);
    const userId = String(req.params.id);
    const user = await adminService.assignUserFaculty(userId, facultyId);
    res.json(
      successResponse(user, req.requestId || 'unknown', { message: 'User faculty updated' })
    );
  });

  listFacultyUsers = asyncHandler(async (req: Request, res: Response) => {
    const roleCodeRaw = (req.query.roleCode as string) || undefined;
    const roleCode = roleCodeRaw ? roleCodeRaw.toUpperCase() : undefined;
    const limitRaw = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offsetRaw = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const facultyId = String(req.params.id);
    const result = await adminService.listUsersByFaculty(facultyId, roleCode, limit, offset);
    res.json(
      successResponse(
        {
          items: result.items,
          total: result.total,
        },
        req.requestId || 'unknown',
        { message: 'Faculty users retrieved', pagination: { limit, offset, total: result.total } }
      )
    );
  });
}

export default new AdminController();
