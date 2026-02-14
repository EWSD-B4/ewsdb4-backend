import { ApiResponse } from '@/types/common';

export function createApiResponse<T = any>(
  success: boolean,
  message?: string,
  data?: T,
  error?: string
): ApiResponse<T> {
  return {
    success,
    message,
    data,
    error,
    timestamp: new Date().toISOString(),
  };
}

export function successResponse<T = any>(message: string, data?: T): ApiResponse<T> {
  return createApiResponse(true, message, data);
}

export function errorResponse(message: string, error?: string): ApiResponse {
  return createApiResponse(false, message, undefined, error);
}
