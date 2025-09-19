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

const toInt = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : NaN;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const stableOrder = (sort: SortDirection) => [
  { add_date: sort },
  { id: sort },
];

export function normalizePagination(
  pagination?: PaginationInput,
): NormalizedPagination {
  const rawPage = pagination?.page ?? 1;
  const rawLimit = pagination?.limit ?? 10;
  const rawSort = pagination?.sort ?? 'desc';

  const parsedPage = toInt(rawPage);
  if (Number.isNaN(parsedPage)) {
    throw new BadRequestException('El parámetro "page" debe ser un entero.');
  }
  const page = clamp(parsedPage, 1, Number.MAX_SAFE_INTEGER);

  const parsedLimit = toInt(rawLimit);
  if (Number.isNaN(parsedLimit)) {
    throw new BadRequestException('El parámetro "limit" debe ser un entero.');
  }
  const limit = clamp(parsedLimit, 1, 100);

  let sort: SortDirection;
  if (rawSort === 'asc' || rawSort === 'desc') {
    sort = rawSort;
  } else if (typeof rawSort === 'string') {
    sort = rawSort.toLowerCase() === 'asc' ? 'asc' : 'desc';
  } else {
    sort = 'desc';
  }

  const take = limit;
  const skip = (page - 1) * take;

  return { page, limit: take, sort, skip, take };
}

export function buildPaginationResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  sort: SortDirection,
) {
  const pages = Math.max(1, Math.ceil(total / limit));
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
