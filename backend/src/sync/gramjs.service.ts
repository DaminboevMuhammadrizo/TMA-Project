import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import type { EntityLike } from 'telegram/define';
import { MediaType } from '@prisma/client';
import { MediaSyncService } from './media-sync.service';
import { NormalizedTelegramMedia } from './normalized-media';

export interface SyncStatus {
  running: boolean;
  lastMessageIdSynced: number | null;
  totalSynced: number;
  lastError: string | null;
}

/** Parses `gramjs:<messageId>` and `gramjs:<messageId>:thumb` refs. */
function parseGramjsRef(ref: string): { messageId: number; thumb: boolean } {
  const parts = ref.split(':');
  // parts[0] === 'gramjs', parts[1] === messageId, parts[2] === 'thumb'?
  const messageId = Number(parts[1]);
  const thumb = parts[2] === 'thumb';
  if (!Number.isFinite(messageId)) {
    throw new Error(`Malformed gramjs ref: ${ref}`);
  }
  return { messageId, thumb };
}

/**
 * MTProto (user-account) client, used for the one-off/resumable full
 * historical backfill of the channel (the Bot API cannot read channel
 * history, only new updates from the moment the bot was added). Also used
 * to serve file bytes for backfilled media, since those don't have a real
 * Bot-API file_id (see downloadByRef).
 */
@Injectable()
export class GramjsService implements OnModuleInit {
  private readonly logger = new Logger(GramjsService.name);
  private client: TelegramClient | null = null;
  private channelEntity: EntityLike | null = null;

  private running = false;
  private lastError: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly mediaSync: MediaSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<string>('ENABLE_GRAMJS', 'true');
    if (enabled === 'false') {
      this.logger.log(
        'GramJS disabled via ENABLE_GRAMJS=false — historical backfill and gramjs-backed file downloads are unavailable. ' +
          'Only the bot (real-time new posts) is active. Set ENABLE_GRAMJS=true to re-enable.',
      );
      return;
    }

    const apiId = this.config.get<string>('TELEGRAM_API_ID');
    const apiHash = this.config.get<string>('TELEGRAM_API_HASH');
    const session = this.config.get<string>('TELEGRAM_SESSION');

    if (!apiId || !apiHash || !session) {
      this.logger.warn(
        'TELEGRAM_API_ID/TELEGRAM_API_HASH/TELEGRAM_SESSION not fully set — GramJS backfill/file-download disabled. ' +
          'Run `npm run gramjs:login` once to obtain TELEGRAM_SESSION.',
      );
      return;
    }

    const client = new TelegramClient(new StringSession(session), Number(apiId), apiHash, {
      connectionRetries: 5,
    });

    try {
      await client.connect();
      this.logger.log('GramJS client connected');

      const channel = this.config.get<string>('TELEGRAM_CHANNEL');
      if (channel) {
        // A fresh session has no cached access_hash for entities it hasn't
        // "seen" yet — resolving a bare numeric channel ID without first
        // loading the dialog list fails with "Could not find the input
        // entity" even though the account is a member of the channel.
        // getDialogs() hydrates that local cache first.
        await client.getDialogs({});
        this.channelEntity = await client.getEntity(channel);
      }

      // Only expose the client once fully set up, so ensureReady() can't
      // hand out a client whose channel entity failed to resolve.
      this.client = client;
    } catch (error) {
      // A bad/revoked session or an unresolvable channel must not take the
      // whole backend down — the Media API and the bot's real-time sync are
      // independent of GramJS and should keep working regardless.
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `GramJS setup failed — historical backfill and gramjs-backed file downloads are disabled until this is fixed: ${this.lastError}`,
      );
      await client.destroy().catch(() => undefined);
    }
  }

  private ensureReady(): { client: TelegramClient; channel: EntityLike } {
    const client = this.client;
    const channel = this.channelEntity;
    if (!client || !channel) {
      throw new Error(
        'GramJS client is not connected. Check TELEGRAM_API_ID/TELEGRAM_API_HASH/TELEGRAM_SESSION/TELEGRAM_CHANNEL.',
      );
    }
    return { client, channel };
  }

  async getStatus(): Promise<SyncStatus> {
    const maxId = await this.mediaSync.getMaxMessageId();
    const total = await this.mediaSync.countAll();
    return {
      running: this.running,
      lastMessageIdSynced: maxId !== null ? Number(maxId) : null,
      totalSynced: total,
      lastError: this.lastError,
    };
  }

  /** Kicks off (or resumes) the full historical backfill. Fire-and-forget: caller does not await completion. */
  runFullSync(): 'started' | 'already_running' {
    if (this.running) {
      return 'already_running';
    }
    this.running = true;
    this.lastError = null;
    // Intentionally not awaited by the caller — this can take a long time for
    // a large channel. Status is polled via getStatus().
    this.backfill()
      .catch((error: Error) => {
        this.lastError = error.message;
        this.logger.error(`Full sync failed: ${error.message}`, error.stack);
      })
      .finally(() => {
        this.running = false;
      });
    return 'started';
  }

  private async backfill(): Promise<void> {
    const { client, channel } = this.ensureReady();
    const maxId = await this.mediaSync.getMaxMessageId();
    const minId = maxId !== null ? Number(maxId) : 0;

    this.logger.log(`Starting full sync from message_id > ${minId}`);

    let processed = 0;
    for await (const message of client.iterMessages(channel, {
      minId,
      reverse: true,
    })) {
      if (!(message instanceof Api.Message)) continue;
      const normalized = await this.mapMessage(message);
      if (!normalized) continue;
      await this.mediaSync.upsert(normalized);
      processed += 1;
    }

    this.logger.log(`Full sync pass complete. Processed ${processed} media messages.`);
  }

  /** Normalizes a raw GramJS message into the shared shape, or null if it has no media we track. */
  async mapMessage(message: Api.Message): Promise<NormalizedTelegramMedia | null> {
    const { client } = this.ensureReady();

    let mediaType: MediaType;
    let doc: Api.Document | null = null;
    let photo: Api.Photo | null = null;

    if (message.photo instanceof Api.Photo) {
      mediaType = MediaType.PHOTO;
      photo = message.photo;
    } else if (message.sticker) {
      mediaType = MediaType.STICKER;
      doc = message.sticker;
    } else if (message.gif) {
      mediaType = MediaType.ANIMATION;
      doc = message.gif;
    } else if (message.videoNote) {
      mediaType = MediaType.VIDEO_NOTE;
      doc = message.videoNote;
    } else if (message.voice) {
      mediaType = MediaType.VOICE;
      doc = message.voice;
    } else if (message.audio) {
      mediaType = MediaType.AUDIO;
      doc = message.audio;
    } else if (message.video) {
      mediaType = MediaType.VIDEO;
      doc = message.video;
    } else {
      return null;
    }

    const caption = message.message || null;
    const viewsCount = message.views ?? 0;
    const createdAt = new Date(message.date * 1000);

    let replyToMessageId: bigint | null = null;
    let replyToText: string | null = null;
    const replyHeader = message.replyTo;
    if (replyHeader && 'replyToMsgId' in replyHeader && replyHeader.replyToMsgId) {
      replyToMessageId = BigInt(replyHeader.replyToMsgId);
      try {
        const replied = await message.getReplyMessage();
        if (replied instanceof Api.Message) {
          replyToText = replied.message || null;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch reply message for ${message.id}: ${(error as Error).message}`);
      }
    }

    const base = {
      messageId: BigInt(message.id),
      caption,
      replyToMessageId,
      replyToText,
      viewsCount,
      createdAt,
    };

    if (photo) {
      const sizes = photo.sizes.filter(
        (s): s is Api.PhotoSize | Api.PhotoSizeProgressive => 'w' in s && 'h' in s,
      );
      const largest = sizes.reduce<Api.PhotoSize | Api.PhotoSizeProgressive | null>((acc, s) => {
        if (!acc || s.w * s.h > acc.w * acc.h) return s;
        return acc;
      }, null);

      return {
        ...base,
        mediaType: MediaType.PHOTO,
        fileId: `gramjs:${message.id}`,
        fileUniqueId: `g${photo.id.toString()}`,
        mimeType: 'image/jpeg',
        fileSize: largest && 'size' in largest ? Number((largest as Api.PhotoSize).size) : null,
        durationSec: null,
        width: largest?.w ?? null,
        height: largest?.h ?? null,
        fileName: null,
        // Frontend falls back to the full file URL when thumbUrl is null (contract note) — simplest for photos.
        thumbFileUniqueId: null,
        stickerSetName: null,
      };
    }

    // doc is guaranteed non-null here (one of the else-if branches above)
    const document = doc as Api.Document;
    let width: number | null = null;
    let height: number | null = null;
    let durationSec: number | null = null;
    let fileName: string | null = null;
    let stickerSetName: string | null = null;

    for (const attr of document.attributes) {
      if (attr instanceof Api.DocumentAttributeVideo) {
        width = attr.w;
        height = attr.h;
        durationSec = Math.round(attr.duration);
      } else if (attr instanceof Api.DocumentAttributeAudio) {
        durationSec = Math.round(attr.duration);
      } else if (attr instanceof Api.DocumentAttributeFilename) {
        fileName = attr.fileName;
      } else if (attr instanceof Api.DocumentAttributeSticker) {
        stickerSetName = await this.resolveStickerSetName(client, attr);
      }
    }

    return {
      ...base,
      mediaType,
      fileId: `gramjs:${message.id}`,
      fileUniqueId: `g${document.id.toString()}`,
      mimeType: document.mimeType || null,
      fileSize: Number(document.size.toString()),
      durationSec,
      width,
      height,
      fileName,
      thumbFileUniqueId: document.thumbs && document.thumbs.length > 0 ? `gramjs:${message.id}:thumb` : null,
      stickerSetName,
    };
  }

  private async resolveStickerSetName(
    client: TelegramClient,
    attr: Api.DocumentAttributeSticker,
  ): Promise<string | null> {
    if (!attr.stickerset) return null;
    if (attr.stickerset instanceof Api.InputStickerSetShortName) {
      return attr.stickerset.shortName;
    }
    if (attr.stickerset instanceof Api.InputStickerSetID) {
      try {
        const result = await client.invoke(
          new Api.messages.GetStickerSet({ stickerset: attr.stickerset, hash: 0 }),
        );
        if (result instanceof Api.messages.StickerSet) {
          return result.set.shortName;
        }
        return null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Downloads file bytes for a `gramjs:<messageId>[:thumb]` reference (used by the media file/thumb proxy). */
  async downloadByRef(ref: string): Promise<Buffer> {
    const { client, channel } = this.ensureReady();
    const { messageId, thumb } = parseGramjsRef(ref);

    const messages = await client.getMessages(channel, { ids: [messageId] });
    const message = messages[0];
    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    const result = await client.downloadMedia(message, thumb ? { thumb: 0 } : {});
    if (!result || typeof result === 'string') {
      throw new NotFoundException(`Could not download media for message ${messageId}`);
    }
    return result;
  }
}
