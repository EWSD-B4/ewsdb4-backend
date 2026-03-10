import Joi from 'joi';

export const createCommentSchema = Joi.object({
  contributionId: Joi.number().integer().positive().required().messages({
    'number.base': 'Contribution ID must be a number',
    'any.required': 'Contribution ID is required',
  }),
  content: Joi.string().min(1).max(2000).required().messages({
    'string.empty': 'Comment content is required',
    'string.max': 'Comment must not exceed 2000 characters',
  }),
});

export const updateCommentSchema = Joi.object({
  content: Joi.string().min(1).max(2000).required().messages({
    'string.empty': 'Comment content is required',
    'string.max': 'Comment must not exceed 2000 characters',
  }),
});
