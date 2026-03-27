import { z } from 'zod';

export const facultyCreateSchema = z.object({
  code: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  description: z.string().min(2).max(200),
});

export const facultyUpdateSchema = z.object({
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
  description: z.string().min(2).max(200).optional(),
});

export const facultyListQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => (v === undefined ? undefined : v === 'true'))
    .optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .refine((v) => Number.isFinite(v) && v > 0 && v <= 100, 'limit must be 1-100')
    .optional(),
  offset: z
    .string()
    .transform((v) => parseInt(v, 10))
    .refine((v) => Number.isFinite(v) && v >= 0, 'offset must be >= 0')
    .optional(),
});
