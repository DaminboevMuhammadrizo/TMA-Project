import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Message } from 'grammy/types';
import { ChannelMedia, MediaType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GramjsService } from './gramjs.service';
import { BotService } from './bot.service';

export interface MigrationStatus {
  running: boolean;
  migrated: number;
  remaining: number;
  lastError: string | null;
}

interface UploadResult {
  fileId: string;
  fileUniqueId: string;
  /**
   * Value to store in the `thumb_file_unique_id` column. Despite the column
   * name, the rest of this codebase stores a fetchable *file_id* there (see
   * NormalizedTelegramMedia's doc comment and bot.service.ts's
   * mapBotMessage) — this keeps the migrated rows consistent with that.
   * `null` means "no thumbnail in this response, leave the existing value alone".
   */
  thumbFileUniqueId: string | null;
}

const BATCH_SIZE = 25;
// Deliberate pacing between rows (one GramJS download + one Bot API upload
// each) — this endpoint exists to FIX a flood-limit problem, so it must not
// reintroduce one on either the GramJS or Bot API side.
const ROW_DELAY_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function largestPhotoSize<T extends { width: number; height: number }>(sizes: T[]): T {
  return sizes.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
}

/** Extracts the new permanent file_id/file_unique_id (and thumb, if present) from an upload response. */
function extractUploadResult(mediaType: MediaType, message: Message): UploadResult {
  switch (mediaType) {
    case MediaType.AUDIO: {
      const a = message.audio;
      if (!a) throw new Error('Upload response missing message.audio');
      return { fileId: a.file_id, fileUniqueId: a.file_unique_id, thumbFileUniqueId: a.thumbnail?.file_id ?? null };
    }
    case MediaType.VOICE: {
      const v = message.voice;
      if (!v) throw new Error('Upload response missing message.voice');
      // Voice messages have no thumbnail field in the Bot API.
      return { fileId: v.file_id, fileUniqueId: v.file_unique_id, thumbFileUniqueId: null };
    }
    case MediaType.VIDEO: {
      const v = message.video;
      if (!v) throw new Error('Upload response missing message.video');
      return { fileId: v.file_id, fileUniqueId: v.file_unique_id, thumbFileUniqueId: v.thumbnail?.file_id ?? null };
    }
    case MediaType.VIDEO_NOTE: {
      const v = message.video_note;
      if (!v) throw new Error('Upload response missing message.video_note');
      return { fileId: v.file_id, fileUniqueId: v.file_unique_id, thumbFileUniqueId: v.thumbnail?.file_id ?? null };
    }
    case MediaType.PHOTO: {
      const sizes = message.photo;
      if (!sizes || sizes.length === 0) throw new Error('Upload response missing message.photo');
      const largest = largestPhotoSize(sizes);
      // No separate thumb resource for photos, same as realtime/backfill sync.
      return { fileId: largest.file_id, fileUniqueId: largest.file_unique_id, thumbFileUniqueId: null };
    }
    case MediaType.ANIMATION: {
      const a = message.animation;
      if (!a) throw new Error('Upload response missing message.animation');
      return { fileId: a.file_id, fileUniqueId: a.file_unique_id, thumbFileUniqueId: a.thumbnail?.file_id ?? null };
    }
    case MediaType.STICKER: {
      const s = message.sticker;
      if (!s) throw new Error('Upload response missing message.sticker');
      return { fileId: s.file_id, fileUniqueId: s.file_unique_id, thumbFileUniqueId: s.thumbnail?.file_id ?? null };
    }
    default: {
      const exhaustiveCheck: never = mediaType;
      throw new Error(`Unhandled MediaType: ${exhaustiveCheck as string}`);
    }
  }
}

/**
 * One-time (resumable) migration of gramjs-backfilled rows to permanent
 * Bot-API file_ids: download each row's bytes once via GramJS, re-upload
 * through the bot to STORAGE_CHAT_ID, and overwrite fileId/fileUniqueId
 * (and thumbFileUniqueId, where the upload response includes one) with the
 * real values. See API_CONTRACT.md "POST /api/sync/migrate-to-bot". Mirrors
 * GramjsService's runFullSync/getStatus shape.
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  private running = false;
  private migrated = 0;
  private lastError: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gramjsService: GramjsService,
    private readonly botService: BotService,
  ) {}

  async getStatus(): Promise<MigrationStatus> {
    const remaining = await this.prisma.channelMedia.count({ where: { fileId: { startsWith: 'gramjs:' } } });
    return { running: this.running, migrated: this.migrated, remaining, lastError: this.lastError };
  }

  /** Kicks off (or resumes) the migration. Fire-and-forget: caller does not await completion. */
  runMigration(): 'started' | 'already_running' {
    if (this.running) {
      return 'already_running';
    }
    this.running = true;
    this.migrated = 0;
    this.lastError = null;
    // Intentionally not awaited — can take a long time for ~1900 rows.
    // Status is polled via getStatus().
    this.migrate()
      .catch((error: Error) => {
        this.lastError = error.message;
        this.logger.error(`Migration failed: ${error.message}`, error.stack);
      })
      .finally(() => {
        this.running = false;
      });
    return 'started';
  }

  private async migrate(): Promise<void> {
    const storageChatIdRaw = this.config.get<string>('STORAGE_CHAT_ID');
    if (!storageChatIdRaw) {
      throw new Error('STORAGE_CHAT_ID not configured — cannot migrate.');
    }
    const storageChatId = Number(storageChatIdRaw);
    if (!Number.isFinite(storageChatId)) {
      throw new Error(`STORAGE_CHAT_ID is not a valid number: ${storageChatIdRaw}`);
    }

    this.logger.log('Starting gramjs -> bot-api migration');
    let processed = 0;

    // Resumable: each pass only ever selects rows still prefixed
    // `gramjs:`, so a restart (or a re-POST after this finishes) just
    // finds nothing left to do instead of redoing completed rows.
    for (;;) {
      const batch = await this.prisma.channelMedia.findMany({
        where: { fileId: { startsWith: 'gramjs:' } },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;

      for (const row of batch) {
        try {
          await this.migrateRow(row, storageChatId);
          this.migrated += 1;
          processed += 1;
        } catch (error) {
          // Per-row failure must not kill the whole batch — log, record,
          // move on to the next row (per API_CONTRACT.md).
          const message = error instanceof Error ? error.message : String(error);
          this.lastError = `row id=${row.id} (messageId=${row.messageId}): ${message}`;
          this.logger.error(`Failed to migrate row id=${row.id}: ${message}`);
        }
        await sleep(ROW_DELAY_MS);
      }
    }

    this.logger.log(`Migration pass complete. Migrated ${processed} rows this run (total this run: ${this.migrated}).`);
  }

  private async migrateRow(row: ChannelMedia, storageChatId: number): Promise<void> {
    const buffer = await this.gramjsService.downloadByRef(row.fileId);
    const message = await this.botService.uploadToStorage(storageChatId, row.mediaType, buffer, row.fileName);
    const result = extractUploadResult(row.mediaType, message);

    await this.prisma.channelMedia.update({
      where: { id: row.id },
      data: {
        fileId: result.fileId,
        fileUniqueId: result.fileUniqueId,
        ...(result.thumbFileUniqueId !== null ? { thumbFileUniqueId: result.thumbFileUniqueId } : {}),
      },
    });

    // Best-effort: drop this row's single-item cache entry so the media/:id
    // endpoint doesn't keep serving the old (now-broken) fileId/fileUniqueId
    // for the rest of its TTL. Never throws — see RedisService.
    await this.redis.del(`media:item:${row.id}`);
  }
}
