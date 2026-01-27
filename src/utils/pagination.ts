import { PaginationParams } from '@/types/common';

export const getPaginationParams = (
  page: string | undefined,
  limit: string | undefined
): PaginationParams => {
  const pageNum = parseInt(page || '1', 10);
  const limitNum = parseInt(limit || '10', 10);

  const validPage = pageNum > 0 ? pageNum : 1;
  const validLimit = limitNum > 0 && limitNum <= 100 ? limitNum : 10;

  return {
    page: validPage,
    limit: validLimit,
    offset: (validPage - 1) * validLimit,
  };
};

export const createPaginationResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) => {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
