import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/auth';
import documentController from './document.controller';

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

// Get specific file by ID
router.get('/files/:fileId', authenticate, documentController.getContributionFileById);

// Download file
router.get('/files/:fileId/download', authenticate, documentController.downloadContributionFile);

// Get signed download URL
router.get('/files/:fileId/download-url', authenticate, documentController.getDownloadUrl);

// Get converted markdown (for DOCX files)
router.get('/files/:fileId/markdown', authenticate, documentController.getConvertedMarkdown);

// Delete file
router.delete('/files/:fileId', authenticate, documentController.deleteContributionFile);

export default router;
