import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InlineKeyboard } from 'grammy';
import type { FilterQuery } from 'grammy';
import type { Message, PhotoSize } from 'grammy/types';
import { MediaType } from '@prisma/client';
import { MediaSyncService } from './media-sync.service';
import { NormalizedTelegramMedia } from './normalized-media';

const TRACKED_UPDATE_KINDS: FilterQuery[] = [
  'channel_post:audio',
  'channel_post:voice',
  'channel_post:video',
  'channel_post:video_note',
  'channel_post:photo',
  'channel_post:animation',
  'channel_post:sticker',
];

/**
 * grammY Bot API client. Handles two jobs:
 *  1. Realtime sync: listens for new posts in the channel (long polling) and
 *     upserts them as they arrive — this is the only way to get *new* media
 *     the instant it's posted (GramJS backfill is a batch/history tool).
 *  2. Provides the Bot API `getFile` capability used by the media file/thumb
 *     proxy for anything that has a real Bot-API file_id.
 */
@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot<Context> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly mediaSync: MediaSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    const token = this.config.get<string>('BOT_TOKEN');
    if (!token) {
      this.logger.warn('BOT_TOKEN not set — realtime bot sync disabled.');
      return;
    }

    this.bot = new Bot<Context>(token);

    const miniAppUrl = this.config.get<string>('MINI_APP_URL');
    this.bot.command('start', async (ctx) => {
      const welcome =
        '📁 Media Gallery\n\nKanaldagi barcha audio, video, rasm va stikerlarni qulay galereya ko\'rinishida ko\'ring, qidiring va ulashing.';
      if (miniAppUrl) {
        await ctx.reply(welcome, {
          reply_markup: new InlineKeyboard().webApp('🚀 Open App', miniAppUrl),
        });
      } else {
        this.logger.warn('MINI_APP_URL not set — /start reply has no Open App button.');
        await ctx.reply(welcome);
      }
    });

    this.bot.on(TRACKED_UPDATE_KINDS, async (ctx) => {
      const message = ctx.channelPost;
      if (!message) return;
      const normalized = mapBotMessage(message);
      if (!normalized) return;
      try {
        await this.mediaSync.upsert(normalized);
      } catch (error) {
        this.logger.error(`Failed to sync realtime message ${message.message_id}: ${(error as Error).message}`);
      }
    });

    this.bot.catch((err) => {
      this.logger.error(`grammY error: ${err.message}`);
    });

    // Long polling for dev/simple deploys. Webhook mode is a viable
    // production alternative but is deploy-target-specific (needs a public
    // HTTPS URL + Express/Nest route wiring) — out of scope here, polling
    // works everywhere unchanged.
    void this.bot.start({
      onStart: () => this.logger.log('grammY bot started (long polling)'),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot?.stop();
  }

  /** Resolves a Bot-API file_id to a downloadable file_path via getFile. */
  async getFilePath(fileId: string): Promise<string> {
    if (!this.bot) {
      throw new Error('BOT_TOKEN not configured — cannot resolve file path');
    }
    const file = await this.bot.api.getFile(fileId);
    if (!file.file_path) {
      throw new Error(`Telegram returned no file_path for file_id=${fileId}`);
    }
    return file.file_path;
  }

  getToken(): string {
    const token = this.config.get<string>('BOT_TOKEN');
    if (!token) {
      throw new Error('BOT_TOKEN not configured');
    }
    return token;
  }
}

function largestPhoto(sizes: PhotoSize[]): PhotoSize {
  return sizes.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b));
}

function stickerMimeType(sticker: NonNullable<Message['sticker']>): string {
  if (sticker.is_video) return 'video/webm';
  if (sticker.is_animated) return 'application/x-tgsticker';
  return 'image/webp';
}

/** Normalizes a grammY (Bot API) channel_post message into the shared shape. */
export function mapBotMessage(message: Message): NormalizedTelegramMedia | null {
  const base = {
    messageId: BigInt(message.message_id),
    caption: message.caption ?? null,
    replyToMessageId: message.reply_to_message ? BigInt(message.reply_to_message.message_id) : null,
    replyToText: message.reply_to_message?.text ?? message.reply_to_message?.caption ?? null,
    viewsCount: 0, // Bot API does not expose channel post view counts
    createdAt: new Date(message.date * 1000),
  };

  if (message.audio) {
    const a = message.audio;
    return {
      ...base,
      mediaType: MediaType.AUDIO,
      fileId: a.file_id,
      fileUniqueId: a.file_unique_id,
      mimeType: a.mime_type ?? null,
      fileSize: a.file_size ?? null,
      durationSec: a.duration ?? null,
      width: null,
      height: null,
      fileName: a.file_name ?? null,
      thumbFileUniqueId: a.thumbnail?.file_id ?? null,
      stickerSetName: null,
    };
  }

  if (message.voice) {
    const v = message.voice;
    return {
      ...base,
      mediaType: MediaType.VOICE,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: v.mime_type ?? null,
      fileSize: v.file_size ?? null,
      durationSec: v.duration ?? null,
      width: null,
      height: null,
      fileName: null,
      thumbFileUniqueId: null,
      stickerSetName: null,
    };
  }

  if (message.video) {
    const v = message.video;
    return {
      ...base,
      mediaType: MediaType.VIDEO,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: v.mime_type ?? null,
      fileSize: v.file_size ?? null,
      durationSec: v.duration ?? null,
      width: v.width ?? null,
      height: v.height ?? null,
      fileName: v.file_name ?? null,
      thumbFileUniqueId: v.thumbnail?.file_id ?? null,
      stickerSetName: null,
    };
  }

  if (message.video_note) {
    const v = message.video_note;
    return {
      ...base,
      mediaType: MediaType.VIDEO_NOTE,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: null,
      fileSize: v.file_size ?? null,
      durationSec: v.duration ?? null,
      width: v.length ?? null,
      height: v.length ?? null,
      fileName: null,
      thumbFileUniqueId: v.thumbnail?.file_id ?? null,
      stickerSetName: null,
    };
  }

  if (message.photo && message.photo.length > 0) {
    const p = largestPhoto(message.photo);
    return {
      ...base,
      mediaType: MediaType.PHOTO,
      fileId: p.file_id,
      fileUniqueId: p.file_unique_id,
      mimeType: 'image/jpeg',
      fileSize: p.file_size ?? null,
      durationSec: null,
      width: p.width ?? null,
      height: p.height ?? null,
      fileName: null,
      // No separate thumb resource for photos — frontend falls back to fileUrl (see API contract).
      thumbFileUniqueId: null,
      stickerSetName: null,
    };
  }

  if (message.animation) {
    const a = message.animation;
    return {
      ...base,
      mediaType: MediaType.ANIMATION,
      fileId: a.file_id,
      fileUniqueId: a.file_unique_id,
      mimeType: a.mime_type ?? null,
      fileSize: a.file_size ?? null,
      durationSec: a.duration ?? null,
      width: a.width ?? null,
      height: a.height ?? null,
      fileName: a.file_name ?? null,
      thumbFileUniqueId: a.thumbnail?.file_id ?? null,
      stickerSetName: null,
    };
  }

  if (message.sticker) {
    const s = message.sticker;
    return {
      ...base,
      mediaType: MediaType.STICKER,
      fileId: s.file_id,
      fileUniqueId: s.file_unique_id,
      mimeType: stickerMimeType(s),
      fileSize: s.file_size ?? null,
      durationSec: null,
      width: s.width ?? null,
      height: s.height ?? null,
      fileName: null,
      thumbFileUniqueId: s.thumbnail?.file_id ?? null,
      stickerSetName: s.set_name ?? null,
    };
  }

  return null;
}
