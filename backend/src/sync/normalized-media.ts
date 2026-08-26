import { MediaType } from '@prisma/client';

/**
 * Common internal shape that both the GramJS backfill path and the grammY
 * realtime path get normalized into before being handed to MediaSyncService.
 * This is what lets one upsert function serve both sync sources.
 */
export interface NormalizedTelegramMedia {
  messageId: bigint;
  mediaType: MediaType;
  /** Bot-API-compatible file_id (realtime), or a `gramjs:<messageId>` reference (backfill). */
  fileId: string;
  /** Stable, globally-unique identifier for this physical file. */
  fileUniqueId: string;
  caption: string | null;
  replyToMessageId: bigint | null;
  replyToText: string | null;
  viewsCount: number;
  mimeType: string | null;
  fileSize: number | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fileName: string | null;
  /**
   * Identifier needed to fetch the thumbnail's bytes: a Bot-API file_id for
   * realtime-sourced items, or a `gramjs:<messageId>:thumb` reference for
   * backfilled items. Null when the media has no thumbnail.
   */
  thumbFileUniqueId: string | null;
  stickerSetName: string | null;
  createdAt: Date;
}
