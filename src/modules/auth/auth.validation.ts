import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  name: Joi.string().min(2).max(100).messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 100 characters',
  }),
  firstName: Joi.string().min(1).max(100).messages({
    'string.min': 'First name must be at least 1 character long',
    'string.max': 'First name cannot exceed 100 characters',
  }),
  lastName: Joi.string().min(1).max(100).messages({
    'string.min': 'Last name must be at least 1 character long',
    'string.max': 'Last name cannot exceed 100 characters',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
  roleId: Joi.number().integer().positive().optional(),
  facultyId: Joi.number().integer().positive().optional(),
}).or('name', 'firstName').messages({
  'object.missing': 'Either name or firstName is required',
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

export const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'New password must be at least 8 characters long',
    'any.required': 'New password is required',
  }),
});

export const forgetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'New password must be at least 8 characters long',
    'any.required': 'New password is required',
  }),
});
