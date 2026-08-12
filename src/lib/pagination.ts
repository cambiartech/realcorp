export const DEFAULT_PAGE_SIZE = 50;

export type SearchParamValue = string | string[] | undefined;
export type SearchParamsInput = URLSearchParams | Record<string, SearchParamValue>;

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  skip: number;
};

export function parsePage(value: SearchParamValue): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return 1;

  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function paginate(total: number, requestedPage: number, pageSize = DEFAULT_PAGE_SIZE): Pagination {
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const safeTotal = Number.isSafeInteger(total) && total > 0 ? total : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);

  return {
    page,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
    skip: (page - 1) * safePageSize,
  };
}

export function toURLSearchParams(input: SearchParamsInput): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}

export function buildPageUrl(
  pathname: string,
  searchParams: SearchParamsInput,
  pageParam: string,
  page: number,
): string {
  const params = toURLSearchParams(searchParams);
  if (page <= 1) params.delete(pageParam);
  else params.set(pageParam, String(page));

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
