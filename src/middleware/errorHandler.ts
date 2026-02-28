import { Request, Response, NextFunction } from 'express';
import logger from '@/shared/logger';
import { ApiErrorResponse } from '@/types/common';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code: string;
  public details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

const isAppErrorLike = (
  err: unknown
): err is Pick<AppError, 'statusCode' | 'code' | 'message' | 'details'> => {
  if (typeof err !== 'object' || err === null) {
    return false;
  }

  const maybeError = err as Record<string, unknown>;
  return (
    typeof maybeError.statusCode === 'number' &&
    typeof maybeError.code === 'string' &&
    typeof maybeError.message === 'string'
  );
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (isAppErrorLike(err)) {
    logger.error(
      `${err.statusCode} - ${err.code} - ${err.message} - ${req.originalUrl} - ${req.method}`
    );

    const payload: ApiErrorResponse = {
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' ? { stack: (err as Error).stack } : {}),
    };

    res.status(err.statusCode).json(payload);
    return;
  }

  logger.error(`500 - ${err.message} - ${req.originalUrl} - ${req.method} - ${err.stack}`);

  const payload: ApiErrorResponse = {
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development'
      ? { error: err.message, stack: err.stack }
      : {}),
  };

  res.status(500).json(payload);
};

export const notFoundHandler = (req: Request, res: Response) => {
  const payload: ApiErrorResponse = {
    success: false,
    message: `Route ${req.originalUrl} not found`,
  };
  res.status(404).json(payload);
};
