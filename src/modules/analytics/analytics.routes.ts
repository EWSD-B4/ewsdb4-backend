import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import analyticsController from './analytics.controller';
import {ROLES} from "@/constants/roles";

const router = Router();

// All analytics routes require authentication and admin role
router.use(authenticate);
router.use(authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.COORDINATOR));

// Dashboard - all metrics in one call
router.get('/dashboard', analyticsController.getDashboard);

// Individual metrics
router.get('/most-viewed-pages', analyticsController.getMostViewedPages);
router.get('/most-active-users', analyticsController.getMostActiveUsers);
router.get('/browser-usage', analyticsController.getBrowserUsage);
router.get('/faculty-distribution', analyticsController.getFacultyDistribution);
router.get('/system-stats', analyticsController.getSystemStats);

export default router;
