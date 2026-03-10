import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import commentController from './comment.controller';

const router = Router();

router.post('/', authenticate, commentController.createComment);

router.get('/', authenticate, commentController.getComments);

router.get(
  '/without-comments',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'COORDINATOR'),
  commentController.getContributionsWithoutComments
);

router.get(
  '/overdue',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'COORDINATOR'),
  commentController.getOverdueContributions
);

router.get('/:id', authenticate, commentController.getCommentById);

router.put('/:id', authenticate, commentController.updateComment);

router.delete('/:id', authenticate, commentController.deleteComment);

export default router;
