import { BadRequestException } from '@nestjs/common';

export type SortDirection = 'asc' | 'desc';

export interface PaginationInput {
  page?: number | string;
  limit?: number | string;
  sort?: SortDirection | string;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  sort: SortDirection;
  skip: number;
  take: number;
}

export function normalizePagination(
  pagination?: PaginationInput,
): NormalizedPagination {
  const rawPage = pagination?.page ?? 1;
  const rawLimit = pagination?.limit ?? 10;
  const rawSort = pagination?.sort ?? 'desc';

  const page = Number(rawPage);
  if (!Number.isFinite(page) || !Number.isInteger(page)) {
    throw new BadRequestException('El parámetro "page" debe ser un entero.');
  }
  if (page < 1) {
    throw new BadRequestException('El parámetro "page" debe ser mayor o igual a 1.');
  }

  const limit = Number(rawLimit);
  if (!Number.isFinite(limit) || !Number.isInteger(limit)) {
    throw new BadRequestException('El parámetro "limit" debe ser un entero.');
  }
  if (limit < 1 || limit > 100) {
    throw new BadRequestException(
      'El parámetro "limit" debe estar entre 1 y 100.',
    );
  }

  let sort: SortDirection;
  if (rawSort === 'asc' || rawSort === 'desc') {
    sort = rawSort;
  } else if (typeof rawSort === 'string') {
    sort = rawSort.toLowerCase() === 'asc' ? 'asc' : 'desc';
  } else {
    sort = 'desc';
  }

  return {
    page,
    limit,
    sort,
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function buildPaginationResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  sort: SortDirection,
) {
  const pages = Math.ceil(total / limit);
  return {
    items,
    page,
    limit,
    sort,
    total,
    pages,
    hasPrev: page > 1,
    hasNext: page < pages,
  };
}

export function buildPageMeta(total: number, page: number, limit: number) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return { total, page, limit, pages };
}
