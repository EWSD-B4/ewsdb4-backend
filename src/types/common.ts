export interface ApiResponse<T = unknown> {
  data?: T;
  meta?: Record<string, unknown>;
  requestId: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
