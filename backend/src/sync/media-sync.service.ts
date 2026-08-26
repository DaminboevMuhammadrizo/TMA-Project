import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { categoryForMediaType, extractLinks } from '../common/media.util';
import { NormalizedTelegramMedia } from './normalized-media';

/**
 * Shared upsert logic for both sync sources (GramJS backfill and grammY
 * realtime). Dedupes on `fileUniqueId`, which is the physical-file identity
 * key regardless of which source observed the message.
 */
@Injectable()
export class MediaSyncService {
  private readonly logger = new Logger(MediaSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsert(media: NormalizedTelegramMedia): Promise<void> {
    const category = categoryForMediaType(media.mediaType);
    const links = extractLinks(media.caption);

    const data = {
      messageId: media.messageId,
      category,
      mediaType: media.mediaType,
      fileId: media.fileId,
      fileUniqueId: media.fileUniqueId,
      caption: media.caption,
      links,
      replyToMessageId: media.replyToMessageId,
      replyToText: media.replyToText,
      viewsCount: media.viewsCount,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      durationSec: media.durationSec,
      width: media.width,
      height: media.height,
      fileName: media.fileName,
      thumbFileUniqueId: media.thumbFileUniqueId,
      stickerSetName: media.stickerSetName,
      createdAt: media.createdAt,
    };

    try {
      await this.prisma.channelMedia.upsert({
        where: { fileUniqueId: media.fileUniqueId },
        create: data,
        update: data,
      });
    } catch (error) {
      this.logger.error(
        `Failed to upsert media for messageId=${media.messageId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /** MAX(message_id) already persisted, used to resume backfill. Null if table is empty. */
  async getMaxMessageId(): Promise<bigint | null> {
    const result = await this.prisma.channelMedia.aggregate({ _max: { messageId: true } });
    return result._max.messageId ?? null;
  }

  async countAll(): Promise<number> {
    return this.prisma.channelMedia.count();
  }
}
