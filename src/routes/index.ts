import { Router } from 'express';
import { successResponse } from '@/utils/response';
import userRoutes from '@/modules/user/user.routes';
import authRoutes from '@/modules/auth/auth.routes';
import documentRoutes from '@/modules/document/document.routes';
import adminRoutes from '@/modules/admin/admin.routes';
import coordinatorRoutes from '@/modules/contribution/coordinator.routes';
import guestRoutes from '@/modules/contribution/guest.routes';
import reportRoutes from '@/modules/report/report.routes';
import academicYearRoutes from '@/modules/academic-year/academic-year.routes';
import termsRoutes from '@/modules/terms/terms.routes';
import commentRoutes from '@/modules/comment/comment.routes';
import notificationRoutes from '@/modules/notification/notification.routes';
const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/documents', documentRoutes);
router.use('/admin', adminRoutes);
router.use('/coordinator', coordinatorRoutes);
router.use('/guest', guestRoutes);
router.use('/reports', reportRoutes);
router.use('/academic-years', academicYearRoutes);
router.use('/terms', termsRoutes);
router.use('/comments', commentRoutes);
router.use('/notifications', notificationRoutes);

router.get('/health', (_req, res) => {
  res
    .status(200)
    .json(
      successResponse(
        { status: 'ok', timestamp: new Date().toISOString() },
        _req.requestId || 'unknown'
      )
    );
});

export default router;
