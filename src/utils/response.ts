import { ApiResponse } from '@/types/common';

export function successResponse<T = unknown>(
  data: T,
  _requestId: string,
  meta?: Record<string, unknown>
): ApiResponse<T> {
  const message =
    typeof meta?.message === 'string' && meta.message.length > 0
      ? meta.message
      : 'Operation successful';

  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
}
