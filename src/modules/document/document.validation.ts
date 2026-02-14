import Joi from 'joi';

export const uploadDocumentSchema = Joi.object({
  file: Joi.any().required(),
});

export const getDocumentByIdSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

export const getUserDocumentsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
});

export const getDownloadUrlSchema = Joi.object({
  id: Joi.string().uuid().required(),
  expiresIn: Joi.number().integer().min(60).max(86400).optional(),
});

export const deleteDocumentSchema = Joi.object({
  id: Joi.string().uuid().required(),
});
