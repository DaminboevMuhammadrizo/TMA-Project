import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../sync/bot.service';
import { GramjsService } from '../sync/gramjs.service';

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Resolves a stored fileId/thumb reference to actual bytes and streams them
 * through the response. Two sources are supported transparently:
 *  - `gramjs:<messageId>[:thumb]` refs (backfilled media, no Bot-API file_id
 *    was ever minted for these) -> downloaded live via the GramJS client.
 *  - real Bot-API file_id (realtime-synced media) -> resolved via
 *    Bot API getFile, then streamed from Telegram's file server.
 */
@Injectable()
export class MediaFileService {
  private readonly logger = new Logger(MediaFileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botService: BotService,
    private readonly gramjsService: GramjsService,
  ) {}

  async streamFile(fileUniqueId: string, res: Response): Promise<void> {
    const record = await this.prisma.channelMedia.findUnique({ where: { fileUniqueId } });
    if (!record) {
      throw new NotFoundException(`Unknown fileUniqueId: ${fileUniqueId}`);
    }
    await this.streamRef(record.fileId, record.mimeType, res);
  }

  async streamThumb(fileUniqueId: string, res: Response): Promise<void> {
    const record = await this.prisma.channelMedia.findUnique({ where: { fileUniqueId } });
    if (!record || !record.thumbFileUniqueId) {
      throw new NotFoundException(`No thumbnail for fileUniqueId: ${fileUniqueId}`);
    }
    await this.streamRef(record.thumbFileUniqueId, 'image/jpeg', res);
  }

  private async streamRef(ref: string, mimeType: string | null, res: Response): Promise<void> {
    res.setHeader('Cache-Control', CACHE_CONTROL);

    if (ref.startsWith('gramjs:')) {
      const buffer = await this.gramjsService.downloadByRef(ref);
      res.setHeader('Content-Type', mimeType ?? 'application/octet-stream');
      res.setHeader('Content-Length', buffer.byteLength.toString());
      res.end(buffer);
      return;
    }

    const filePath = await this.botService.getFilePath(ref);
    const token = this.botService.getToken();
    const url = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      this.logger.error(`Failed to fetch file from Telegram: ${upstream.status} ${url}`);
      throw new NotFoundException('File not available from Telegram');
    }

    res.setHeader('Content-Type', mimeType ?? upstream.headers.get('content-type') ?? 'application/octet-stream');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    Readable.fromWeb(upstream.body as import('stream/web').ReadableStream).pipe(res);
  }
}
