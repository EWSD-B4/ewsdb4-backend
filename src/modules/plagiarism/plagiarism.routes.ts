import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import plagiarismController from './plagiarism.controller';
import { ROLES } from '@/constants/roles';

const router = Router();

// All plagiarism routes require authentication and coordinator role
router.use(authenticate);
router.use(authorize(ROLES.COORDINATOR));

// Get all flagged contributions
router.get('/flagged', plagiarismController.getFlaggedContributions);

// Get plagiarism report for specific contribution
router.get('/report/:contributionId', plagiarismController.getPlagiarismReport);

// Review plagiarism case (approve/reject)
router.post('/review/:contributionId', plagiarismController.reviewPlagiarism);

export default router;
