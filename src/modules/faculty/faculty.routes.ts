import { Router } from 'express';
import facultyController from './faculty.controller';
import { validateZod } from '@/middleware/validateZod';
import { facultyCreateSchema, facultyUpdateSchema } from './faculty.validation';

const router = Router();

router.post('/', validateZod(facultyCreateSchema), facultyController.createFaculty);
router.get('/', facultyController.listFaculties);
router.patch('/:id', validateZod(facultyUpdateSchema), facultyController.updateFaculty);
router.patch('/:id/deactivate', facultyController.deactivateFaculty);

export default router;
