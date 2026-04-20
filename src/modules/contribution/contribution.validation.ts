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
  comment: Joi.string().min(10).max(1000).optional().allow('', null).messages({
    'string.min': 'Comment must be at least 10 characters',
    'string.max': 'Comment must not exceed 1000 characters',
  }),
});

export const rejectContributionSchema = Joi.object({
  comment: Joi.string().min(10).max(1000).optional().allow('', null).messages({
    'string.min': 'Comment must be at least 10 characters',
    'string.max': 'Comment must not exceed 1000 characters',
  }),
});

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'submitted', 'under_review', 'selected', 'rejected', 'published', 'flagged_plagiarism').required().messages({
    'any.required': 'Status is required',
    'any.only': 'Invalid status value',
  }),
});
