import { ApiResponse } from '@/types/common';

export function successResponse<T = unknown>(
  data: T,
  requestId: string,
  meta?: Record<string, unknown>
): ApiResponse<T> {
  return {
    data,
    meta,
    requestId,
  };
}
