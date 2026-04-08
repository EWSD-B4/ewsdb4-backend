import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/auth';
import { authorize } from '@/middleware/authorize';
import { ROLES } from '@/constants/roles';
import { requireFacultyIfRoleNeedsIt } from '@/middleware/facultyScope';
import contributionController from './contribution.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const docxMimeTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    const imageMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    const allAllowedTypes = [...docxMimeTypes, ...imageMimeTypes];

    if (allAllowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only DOCX and image files (JPEG, PNG, GIF, WebP) are allowed.'));
    }
  },
});

router.post(
  '/contributions/submit',
  authenticate,
  authorize(ROLES.STUDENT),
  requireFacultyIfRoleNeedsIt,
  upload.fields([
    { name: 'docx', maxCount: 1 },
    { name: 'images', maxCount: 5 }
  ]),
  contributionController.submit
);

router.get(
  '/contributions',
  authenticate,
  authorize(ROLES.STUDENT),
  requireFacultyIfRoleNeedsIt,
  contributionController.getStudentContributions
);

router.put(
  '/contributions/:id',
  authenticate,
  authorize(ROLES.STUDENT),
  requireFacultyIfRoleNeedsIt,
  upload.fields([
    { name: 'docx', maxCount: 1 },
    { name: 'images', maxCount: 5 },
  ]),
  contributionController.replaceContributionFiles
);

router.delete(
  '/contributions/:id',
  authenticate,
  authorize(ROLES.STUDENT),
  requireFacultyIfRoleNeedsIt,
  contributionController.deleteStudentContribution
);


export default router;
