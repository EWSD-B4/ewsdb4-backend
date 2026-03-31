import Joi from 'joi';

export const createContributionSchema = Joi.object({
  title: Joi.string().min(3).max(255).required().messages({
    'string.empty': 'Title is required',
    'string.min': 'Title must be at least 3 characters',
    'string.max': 'Title must not exceed 255 characters',
  }),
  academicYearId: Joi.number().integer().positive().required().messages({
    'number.base': 'Academic year ID must be a number',
    'any.required': 'Academic year ID is required',
  }),
});

export const updateContributionSchema = Joi.object({
  title: Joi.string().min(3).max(255).required().messages({
    'string.empty': 'Title is required',
    'string.min': 'Title must be at least 3 characters',
    'string.max': 'Title must not exceed 255 characters',
  }),
});

export const submitContributionSchema = Joi.object({
  termsId: Joi.number().integer().positive().required().messages({
    'number.base': 'Terms ID must be a number',
    'any.required': 'Terms ID is required',
  }),
});

export const selectContributionSchema = Joi.object({
  selected: Joi.boolean().required().messages({
    'any.required': 'Selection status is required',
  }),
});
