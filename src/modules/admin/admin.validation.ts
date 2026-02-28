import { z } from 'zod';

export const assignFacultySchema = z.object({
  facultyId: z.union([z.number().int(), z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10))]).nullable().optional(),
});
