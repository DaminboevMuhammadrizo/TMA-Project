import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildMeta, MediaItem, PaginatedResponse, toMediaItem } from '../media/media-item.mapper';
import { GetFavoritesQueryDto } from './dto/get-favorites-query.dto';

/**
 * Favorites are per-user and cheap to query directly (indexed by the
 * @@unique([telegramUserId, mediaId]) constraint) — per API_CONTRACT.md
 * ("Redis caching"), favorites responses are intentionally NOT cached, so
 * they stay fresh immediately after a POST/DELETE.
 */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: bigint, query: GetFavoritesQueryDto): Promise<PaginatedResponse<MediaItem>> {
    const { page, limit } = query;

    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { telegramUserId: userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { media: true },
      }),
      this.prisma.favorite.count({ where: { telegramUserId: userId } }),
    ]);

    return {
      data: favorites.map((favorite) => ({ ...toMediaItem(favorite.media), isFavorited: true })),
      meta: buildMeta(page, limit, total),
    };
  }

  /** Idempotent: favoriting twice is a no-op, not an error (per API_CONTRACT.md). */
  async add(userId: bigint, mediaId: number): Promise<void> {
    const exists = await this.prisma.channelMedia.findUnique({ where: { id: mediaId }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Media item ${mediaId} not found`);
    }

    await this.prisma.favorite.upsert({
      where: { telegramUserId_mediaId: { telegramUserId: userId, mediaId } },
      create: { telegramUserId: userId, mediaId },
      update: {},
    });
  }

  /** Idempotent: removing a favorite that doesn't exist is a no-op. */
  async remove(userId: bigint, mediaId: number): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { telegramUserId: userId, mediaId } });
  }
}
