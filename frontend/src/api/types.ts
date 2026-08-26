// Types mirrored exactly from docs/API_CONTRACT.md — keep in sync with the backend.

export type Category = 'AUDIO' | 'VIDEO' | 'IMAGE_STICKER';

export type MediaType =
  | 'AUDIO'
  | 'VOICE'
  | 'VIDEO'
  | 'VIDEO_NOTE'
  | 'PHOTO'
  | 'ANIMATION'
  | 'STICKER';

export interface MediaItem {
  id: number;
  messageId: number;
  category: Category;
  mediaType: MediaType;
  fileId: string;
  fileUniqueId: string;
  /** Relative path, e.g. `/api/media/file/:fileUniqueId` — see buildMediaUrl(). */
  fileUrl: string;
  /** Relative path or null — see buildMediaUrl(). */
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
  createdAt: string; // ISO 8601
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MediaListResponse {
  data: MediaItem[];
  meta: PaginationMeta;
}
