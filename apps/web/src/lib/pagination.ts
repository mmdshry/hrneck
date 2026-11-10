export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 5;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type PaginatedPayload<T> = {
  data: T[];
  meta: PaginationMeta;
};

type LaravelPaginatorLike<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
};

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function emptyMeta(perPage: number = DEFAULT_PAGE_SIZE): PaginationMeta {
  return {
    current_page: 1,
    last_page: 1,
    per_page: perPage,
    total: 0,
  };
}

/** Parse `{ data: T[], meta }` or Laravel nested `{ data: { data, current_page, ... } }`. */
export function parsePaginatedResponse<T>(
  payload: unknown,
  fallbackPerPage: number = DEFAULT_PAGE_SIZE,
): PaginatedPayload<T> {
  if (!payload || typeof payload !== "object") {
    return { data: [], meta: emptyMeta(fallbackPerPage) };
  }

  const root = payload as {
    data?: T[] | LaravelPaginatorLike<T>;
    meta?: Partial<PaginationMeta>;
  };

  if (Array.isArray(root.data)) {
    const meta = root.meta ?? {};
    const total = asNumber(meta.total, root.data.length);
    const perPage = asNumber(meta.per_page, fallbackPerPage);
    const currentPage = asNumber(meta.current_page, 1);
    const lastPage = asNumber(
      meta.last_page,
      Math.max(1, Math.ceil(total / perPage) || 1),
    );
    return {
      data: root.data,
      meta: {
        current_page: currentPage,
        last_page: lastPage,
        per_page: perPage,
        total,
      },
    };
  }

  if (root.data && typeof root.data === "object" && Array.isArray(root.data.data)) {
    const nested = root.data;
    const total = asNumber(nested.total, nested.data?.length ?? 0);
    const perPage = asNumber(nested.per_page, fallbackPerPage);
    const currentPage = asNumber(nested.current_page, 1);
    const lastPage = asNumber(
      nested.last_page,
      Math.max(1, Math.ceil(total / perPage) || 1),
    );
    return {
      data: nested.data ?? [],
      meta: {
        current_page: currentPage,
        last_page: lastPage,
        per_page: perPage,
        total,
      },
    };
  }

  return { data: [], meta: emptyMeta(fallbackPerPage) };
}

export function paginationQuery(
  page: number,
  perPage: number,
  extra?: Record<string, string | number | boolean | null | undefined>,
): string {
  const params = new URLSearchParams();
  params.set("page", String(Math.max(1, page)));
  params.set("per_page", String(perPage));
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === null || value === undefined || value === "") continue;
      params.set(key, String(value));
    }
  }
  return params.toString();
}

/** Client-side slice for small/detail lists that are not server-paginated. */
export function paginateLocal<T>(
  items: T[],
  page: number,
  perPage: number,
): PaginatedPayload<T> {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage) || 1);
  const currentPage = Math.min(Math.max(1, page), lastPage);
  const start = (currentPage - 1) * perPage;
  return {
    data: items.slice(start, start + perPage),
    meta: {
      current_page: currentPage,
      last_page: lastPage,
      per_page: perPage,
      total,
    },
  };
}
