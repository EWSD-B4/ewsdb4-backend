import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '@/shared/errors/AppError';

export const validateZod = (schema: ZodSchema<unknown>) => {
  return (
    req: Request<Record<string, string>, unknown, unknown>,
    _res: Response,
    next: NextFunction
  ) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ValidationError('Validation failed', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
};
