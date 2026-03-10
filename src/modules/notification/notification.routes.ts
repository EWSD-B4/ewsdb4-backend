import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import notificationController from './notification.controller';

const router = Router();

router.get('/', authenticate, notificationController.getUserNotifications);

router.put('/:id/read', authenticate, notificationController.markAsRead);

router.put('/read-all', authenticate, notificationController.markAllAsRead);

router.delete('/:id', authenticate, notificationController.deleteNotification);

export default router;
