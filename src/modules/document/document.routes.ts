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

router.post('/upload', authenticate, upload.single('file'), documentController.uploadDocument);
router.get('/', authenticate, documentController.getUserDocuments);
router.get('/:id', authenticate, documentController.getDocumentById);
router.get('/:id/download', authenticate, documentController.downloadDocument);
router.get('/:id/download-url', authenticate, documentController.getDownloadUrl);
router.get('/:id/converted/html', authenticate, documentController.getConvertedHtml);
router.get('/:id/converted/json', authenticate, documentController.getConvertedJson);
router.delete('/:id', authenticate, documentController.deleteDocument);

export default router;
