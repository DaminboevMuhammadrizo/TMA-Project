import { ChannelMedia } from '@prisma/client';

/**
 * Base media fields as returned by the API, minus `isFavorited`. This is the
 * shape cached in Redis (see MediaService) — `isFavorited` is per-user, so
 * it must never be baked into a cache entry that's shared across users.
 */
export interface MediaItemBase {
  id: number;
  messageId: number;
  category: string;
  mediaType: string;
  fileId: string;
  fileUniqueId: string;
  fileUrl: string;
  thumbUrl: string | null;
  caption: string | null;
  links: string[];
  replyToMessageId: number | null;
  replyToText: string | null;
  viewsCount: number;
  mimeType: string | null;
  fileSize: number | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fileName: string | null;
  stickerSetName: string | null;
  createdAt: string;
}

/** JSON shape returned by the API, per API_CONTRACT.md */
export interface MediaItem extends MediaItemBase {
  isFavorited: boolean; // false if x-telegram-init-data absent/invalid
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export function toMediaItem(row: ChannelMedia): MediaItemBase {
  return {
    id: row.id,
    messageId: Number(row.messageId),
    category: row.category,
    mediaType: row.mediaType,
    fileId: row.fileId,
    fileUniqueId: row.fileUniqueId,
    fileUrl: `/media/file/${row.fileUniqueId}`,
    thumbUrl: row.thumbFileUniqueId ? `/media/thumb/${row.fileUniqueId}` : null,
    caption: row.caption,
    links: row.links,
    replyToMessageId: row.replyToMessageId !== null ? Number(row.replyToMessageId) : null,
    replyToText: row.replyToText,
    viewsCount: row.viewsCount,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    durationSec: row.durationSec,
    width: row.width,
    height: row.height,
    fileName: row.fileName,
    stickerSetName: row.stickerSetName,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Merges the per-user favorite flag onto a (possibly cached) base item. */
export function withFavorited(item: MediaItemBase, isFavorited: boolean): MediaItem {
  return { ...item, isFavorited };
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
