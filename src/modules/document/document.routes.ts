import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import documentController from './document.controller';
import documentContentController from './document-content.controller';
import {authorize} from "@/middleware/authorize";

const router = Router();

// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 50 * 1024 * 1024,
//   },
//   fileFilter: (_req, file, cb) => {
//     const allowedMimeTypes = [
//       'application/pdf',
//       'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       'application/vnd.ms-excel',
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//       'text/plain',
//       'text/html',
//       'image/jpeg',
//       'image/png',
//       'image/gif',
//     ];
//
//     if (allowedMimeTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type. Only documents and images are allowed.'));
//     }
//   },
// });
//
// // Upload file to contribution (DOCX or image)
// router.post(
//   '/contributions/:contributionId/files',
//   authenticate,
//   authorize('STUDENT'),
//   upload.single('file'),
//   documentController.uploadContributionFile
// );

// Get all files for a contribution
router.get(
  '/contributions/:contributionId/files',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'COORDINATOR', 'STUDENT'),
  documentController.getContributionFiles
);

// Download primary DOCX by contribution ID
router.get(
  '/contributions/:contributionId/files/download',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'COORDINATOR'),

  documentController.downloadByContributionId
);

// Get signed download URL for primary DOCX by contribution ID
router.get(
  '/contributions/:contributionId/files/download-url',
  authenticate,
  authorize('ADMIN', 'MANAGER', 'COORDINATOR', 'STUDENT'),
  documentController.getDownloadUrlByContributionId
);

// Get specific file by ID
router.get('/files/:fileId', authenticate, authorize('ADMIN', 'MANAGER', 'COORDINATOR', 'STUDENT'), documentController.getContributionFileById);

// Download file
router.get('/files/:fileId/download', authenticate, authorize('ADMIN', 'MANAGER', 'COORDINATOR', 'STUDENT'), documentController.downloadContributionFile);

// Get signed download URL
router.get('/files/:fileId/download-url', authenticate, authorize('ADMIN', 'MANAGER', 'COORDINATOR', 'STUDENT'), documentController.getDownloadUrl);


// Delete file
router.delete('/files/:fileId', authenticate, authorize('ADMIN', 'STUDENT'), documentController.deleteContributionFile);

// TipTap JSON Content Routes
router.get('/content/contribution/:contributionId/stats', authenticate, authorize('ADMIN', 'MANAGER', 'COORDINATOR'), documentContentController.getStatsByContributionId);
router.get('/content/contribution/:contributionId', authenticate, authorize('ADMIN', 'MANAGER'), documentContentController.getByContributionId);
router.get('/content/:contributionFileId/stats', authenticate, authorize('ADMIN', 'MANAGER', 'COORDINATOR'), documentContentController.getStatistics);
router.get('/content/:contributionFileId', authenticate, authorize('ADMIN', 'MANAGER', 'COORDINATOR', 'STUDENT'), documentContentController.getByContributionFileId);

export default router;
