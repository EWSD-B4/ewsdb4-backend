import { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/asyncHandler';
import notificationService from './notification.service';
import { successResponse } from '@/utils/response';

class NotificationController {
  getUserNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(String(req.user!.id), 10);
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await notificationService.getUserNotifications(userId, unreadOnly);

    return res.json(
      successResponse(
        { notifications, total: notifications.length },
        req.requestId || 'unknown',
        {
          message: 'Notifications retrieved successfully',
        }
      )
    );
  });

  markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.user!.id), 10);
    const notification = await notificationService.markAsRead(id, userId);

    return res.json(
      successResponse(notification, req.requestId || 'unknown', {
        message: 'Notification marked as read',
      })
    );
  });

  markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(String(req.user!.id), 10);
    await notificationService.markAllAsRead(userId);

    return res.json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'All notifications marked as read',
      })
    );
  });

  deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.user!.id), 10);
    await notificationService.deleteNotification(id, userId);

    return res.json(
      successResponse({ success: true }, req.requestId || 'unknown', {
        message: 'Notification deleted successfully',
      })
    );
  });
}

export default new NotificationController();
