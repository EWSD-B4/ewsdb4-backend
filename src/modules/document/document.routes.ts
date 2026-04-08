import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/auth';
import documentController from './document.controller';
import documentContentController from './document-content.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/html',
      'image/jpeg',
      'image/png',
      'image/gif',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents and images are allowed.'));
    }
  },
});

// Upload file to contribution (DOCX or image)
router.post(
  '/contributions/:contributionId/files',
  authenticate,
  upload.single('file'),
  documentController.uploadContributionFile
);

// Get all files for a contribution
router.get(
  '/contributions/:contributionId/files',
  authenticate,
  documentController.getContributionFiles
);

// Download primary DOCX by contribution ID
router.get(
  '/contributions/:contributionId/files/download',
  authenticate,
  documentController.downloadByContributionId
);

// Get signed download URL for primary DOCX by contribution ID
router.get(
  '/contributions/:contributionId/files/download-url',
  authenticate,
  documentController.getDownloadUrlByContributionId
);

// Get specific file by ID
router.get('/files/:fileId', authenticate, documentController.getContributionFileById);

// Download file
router.get('/files/:fileId/download', authenticate, documentController.downloadContributionFile);

// Get signed download URL
router.get('/files/:fileId/download-url', authenticate, documentController.getDownloadUrl);


// Delete file
router.delete('/files/:fileId', authenticate, documentController.deleteContributionFile);

// TipTap JSON Content Routes
router.get('/content/contribution/:contributionId/stats', authenticate, documentContentController.getStatsByContributionId);
router.get('/content/contribution/:contributionId', authenticate, documentContentController.getByContributionId);
router.get('/content/:contributionFileId/stats', authenticate, documentContentController.getStatistics);
router.get('/content/:contributionFileId', authenticate, documentContentController.getByContributionFileId);

export default router;
