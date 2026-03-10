import Joi from 'joi';

export const createTermsSchema = Joi.object({
  version: Joi.string().min(1).max(50).required().messages({
    'string.empty': 'Version is required',
    'string.max': 'Version must not exceed 50 characters',
  }),
  content: Joi.string().min(10).required().messages({
    'string.empty': 'Content is required',
    'string.min': 'Content must be at least 10 characters',
  }),
  effectiveDate: Joi.date().iso().required().messages({
    'date.base': 'Effective date must be a valid date',
    'any.required': 'Effective date is required',
  }),
});

export const updateTermsSchema = Joi.object({
  content: Joi.string().min(10).optional().messages({
    'string.min': 'Content must be at least 10 characters',
  }),
  effectiveDate: Joi.date().iso().optional().messages({
    'date.base': 'Effective date must be a valid date',
  }),
  isActive: Joi.boolean().optional(),
}).min(1);
