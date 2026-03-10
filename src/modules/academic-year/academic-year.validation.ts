import Joi from 'joi';

export const createAcademicYearSchema = Joi.object({
  yearName: Joi.string().min(4).max(20).required().messages({
    'string.empty': 'Year name is required',
    'string.min': 'Year name must be at least 4 characters',
    'string.max': 'Year name must not exceed 20 characters',
  }),
  startDate: Joi.date().iso().required().messages({
    'date.base': 'Start date must be a valid date',
    'any.required': 'Start date is required',
  }),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.base': 'End date must be a valid date',
    'date.greater': 'End date must be after start date',
    'any.required': 'End date is required',
  }),
  closureDate: Joi.date().iso().optional().allow(null).messages({
    'date.base': 'Closure date must be a valid date',
  }),
  closureFinalDate: Joi.date()
    .iso()
    .optional()
    .allow(null)
    .when('closureDate', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('closureDate')),
    })
    .messages({
      'date.base': 'Final closure date must be a valid date',
      'date.greater': 'Final closure date must be after closure date',
    }),
});

export const updateAcademicYearSchema = Joi.object({
  yearName: Joi.string().min(4).max(20).optional().messages({
    'string.min': 'Year name must be at least 4 characters',
    'string.max': 'Year name must not exceed 20 characters',
  }),
  startDate: Joi.date().iso().optional().messages({
    'date.base': 'Start date must be a valid date',
  }),
  endDate: Joi.date().iso().optional().messages({
    'date.base': 'End date must be a valid date',
  }),
  closureDate: Joi.date().iso().optional().allow(null).messages({
    'date.base': 'Closure date must be a valid date',
  }),
  closureFinalDate: Joi.date().iso().optional().allow(null).messages({
    'date.base': 'Final closure date must be a valid date',
  }),
  isCurrent: Joi.boolean().optional(),
  isActive: Joi.boolean().optional(),
}).min(1);
