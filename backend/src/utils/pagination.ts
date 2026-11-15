export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Parsea parámetros de paginación desde query params de Express.
 * page default 1 (min 1), limit default 20 (min 1, max 100).
 */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const rawPage = Number(query['page']);
  const rawLimit = Number(query['limit']);

  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}
