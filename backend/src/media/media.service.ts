import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GetMediaQueryDto } from './dto/get-media-query.dto';
import { SearchMediaQueryDto } from './dto/search-media-query.dto';
import {
  buildMeta,
  MediaItem,
  MediaItemBase,
  PaginatedResponse,
  toMediaItem,
  withFavorited,
} from './media-item.mapper';

// TTLs per API_CONTRACT.md ("Redis caching"): ~10 min for list/search, ~1h for single item.
const LIST_CACHE_TTL_SECONDS = 600;
const ITEM_CACHE_TTL_SECONDS = 3600;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll(query: GetMediaQueryDto, userId: bigint | null): Promise<PaginatedResponse<MediaItem>> {
    const { category, mediaType, page, limit } = query;
    const cacheKey = `media:list:${category ?? ''}:${mediaType ?? ''}:${page}:${limit}`;

    let cached = await this.redis.get<PaginatedResponse<MediaItemBase>>(cacheKey);
    if (!cached) {
      const where: Prisma.ChannelMediaWhereInput = {
        ...(category ? { category } : {}),
        ...(mediaType ? { mediaType } : {}),
      };

      const [rows, total] = await Promise.all([
        this.prisma.channelMedia.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.channelMedia.count({ where }),
      ]);

      cached = { data: rows.map(toMediaItem), meta: buildMeta(page, limit, total) };
      await this.redis.set(cacheKey, cached, LIST_CACHE_TTL_SECONDS);
    }

    return this.withFavorites(cached, userId);
  }

  async search(query: SearchMediaQueryDto, userId: bigint | null): Promise<PaginatedResponse<MediaItem>> {
    const { q, category, page, limit } = query;
    const cacheKey = `media:search:${q}:${category ?? ''}:${page}:${limit}`;

    let cached = await this.redis.get<PaginatedResponse<MediaItemBase>>(cacheKey);
    if (!cached) {
      const pattern = `%${q}%`;
      const categoryClause = category ? Prisma.sql`AND category = ${category}::"Category"` : Prisma.empty;
      const matchClause = Prisma.sql`
        (
          caption ILIKE ${pattern}
          OR reply_to_text ILIKE ${pattern}
          OR EXISTS (SELECT 1 FROM unnest(links) AS l WHERE l ILIKE ${pattern})
        )
        ${categoryClause}
      `;

      const idRows = await this.prisma.$queryRaw<Array<{ id: number }>>(
        Prisma.sql`
          SELECT id FROM channel_media
          WHERE ${matchClause}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `,
      );
      const countRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM channel_media
          WHERE ${matchClause}
        `,
      );
      const total = Number(countRows[0]?.count ?? 0n);
      const ids = idRows.map((r) => r.id);

      if (ids.length === 0) {
        cached = { data: [], meta: buildMeta(page, limit, total) };
      } else {
        const rows = await this.prisma.channelMedia.findMany({ where: { id: { in: ids } } });
        const byId = new Map(rows.map((r) => [r.id, r]));
        const ordered = ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r));
        cached = { data: ordered.map(toMediaItem), meta: buildMeta(page, limit, total) };
      }
      await this.redis.set(cacheKey, cached, LIST_CACHE_TTL_SECONDS);
    }

    return this.withFavorites(cached, userId);
  }

  async findOne(id: number, userId: bigint | null): Promise<MediaItem> {
    const cacheKey = `media:item:${id}`;

    let cached = await this.redis.get<MediaItemBase>(cacheKey);
    if (!cached) {
      const row = await this.prisma.channelMedia.findUnique({ where: { id } });
      if (!row) {
        throw new NotFoundException(`Media item ${id} not found`);
      }
      cached = toMediaItem(row);
      await this.redis.set(cacheKey, cached, ITEM_CACHE_TTL_SECONDS);
    }

    const favorited = userId ? await this.isFavorited(userId, id) : false;
    return withFavorited(cached, favorited);
  }

  private async withFavorites(
    page: PaginatedResponse<MediaItemBase>,
    userId: bigint | null,
  ): Promise<PaginatedResponse<MediaItem>> {
    const favoritedIds = await this.getFavoritedIds(
      userId,
      page.data.map((item) => item.id),
    );
    return {
      data: page.data.map((item) => withFavorited(item, favoritedIds.has(item.id))),
      meta: page.meta,
    };
  }

  /** One batched query per page/response, per API_CONTRACT.md — never N+1. */
  private async getFavoritedIds(userId: bigint | null, mediaIds: number[]): Promise<Set<number>> {
    if (!userId || mediaIds.length === 0) return new Set();
    const rows = await this.prisma.favorite.findMany({
      where: { telegramUserId: userId, mediaId: { in: mediaIds } },
      select: { mediaId: true },
    });
    return new Set(rows.map((r) => r.mediaId));
  }

  private async isFavorited(userId: bigint, mediaId: number): Promise<boolean> {
    const favorite = await this.prisma.favorite.findUnique({
      where: { telegramUserId_mediaId: { telegramUserId: userId, mediaId } },
      select: { id: true },
    });
    return favorite !== null;
  }
}
