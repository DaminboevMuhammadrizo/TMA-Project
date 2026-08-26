import type { Category, MediaItem, MediaListResponse, MediaType } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  // Fail loudly in dev rather than silently issuing requests to `undefined/...`.
  // eslint-disable-next-line no-console
  console.error(
    'VITE_API_BASE_URL is not set. Copy .env.example to .env and set it before running the app.',
  );
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * The contract's `fileUrl`/`thumbUrl` fields are paths relative to the API
 * root (e.g. `/api/media/file/:fileUniqueId`). Per API_CONTRACT.md "Notes for
 * frontend", the absolute URL is built as `${VITE_API_BASE_URL}${item.fileUrl}`.
 */
export function buildMediaUrl(relativePath: string): string {
  return `${API_BASE_URL}${relativePath}`;
}

/** Returns a copy of the item with fileUrl/thumbUrl rewritten to absolute URLs. */
export function resolveMediaItem(item: MediaItem): MediaItem {
  return {
    ...item,
    fileUrl: buildMediaUrl(item.fileUrl),
    thumbUrl: item.thumbUrl ? buildMediaUrl(item.thumbUrl) : null,
  };
}

async function request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    throw new ApiError(
      `Network error while contacting the API. Is the backend running at ${API_BASE_URL}?`,
      0,
    );
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // response wasn't JSON — ignore, keep default message
    }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

function normalizeList(res: MediaListResponse): MediaListResponse {
  return { ...res, data: res.data.map(resolveMediaItem) };
}

export interface GetMediaParams {
  category?: Category;
  mediaType?: MediaType;
  page?: number;
  limit?: number;
}

/** GET /api/media */
export async function getMedia(params: GetMediaParams = {}): Promise<MediaListResponse> {
  const res = await request<MediaListResponse>('/media', {
    category: params.category,
    mediaType: params.mediaType,
    page: params.page,
    limit: params.limit,
  });
  return normalizeList(res);
}

export interface SearchMediaParams {
  q: string;
  category?: Category;
  page?: number;
  limit?: number;
}

/** GET /api/media/search */
export async function searchMedia(params: SearchMediaParams): Promise<MediaListResponse> {
  const res = await request<MediaListResponse>('/media/search', {
    q: params.q,
    category: params.category,
    page: params.page,
    limit: params.limit,
  });
  return normalizeList(res);
}

/** GET /api/media/:id */
export async function getMediaById(id: number): Promise<MediaItem> {
  const res = await request<MediaItem>(`/media/${id}`);
  return resolveMediaItem(res);
}
