import { Router } from 'express';
import { successResponse } from '@/utils/response';
import userRoutes from '@/modules/user/user.routes';
import authRoutes from '@/modules/auth/auth.routes';
import documentRoutes from '@/modules/document/document.routes';
import adminRoutes from '@/modules/admin/admin.routes';
import coordinatorRoutes from '@/modules/contribution/coordinator.routes';
import guestRoutes from '@/modules/contribution/guest.routes';
import reportRoutes from '@/modules/report/report.routes';
const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/documents', documentRoutes);
router.use('/admin', adminRoutes);
router.use('/coordinator', coordinatorRoutes);
router.use('/guest', guestRoutes);
router.use('/reports', reportRoutes);

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
