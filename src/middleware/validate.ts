import Joi from 'joi';
import { BadRequestError } from '@/shared/errors/AppError';

export function validate<T>(schema: Joi.ObjectSchema, data: any): T {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorMessage = error.details.map((detail) => detail.message).join(', ');
    throw new BadRequestError(errorMessage);
  }

  return value as T;
}
