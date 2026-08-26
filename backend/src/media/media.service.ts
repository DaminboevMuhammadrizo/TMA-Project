import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetMediaQueryDto } from './dto/get-media-query.dto';
import { SearchMediaQueryDto } from './dto/search-media-query.dto';
import { buildMeta, MediaItem, PaginatedResponse, toMediaItem } from './media-item.mapper';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetMediaQueryDto): Promise<PaginatedResponse<MediaItem>> {
    const { category, mediaType, page, limit } = query;
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

    return {
      data: rows.map(toMediaItem),
      meta: buildMeta(page, limit, total),
    };
  }

  async search(query: SearchMediaQueryDto): Promise<PaginatedResponse<MediaItem>> {
    const { q, category, page, limit } = query;
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
      return { data: [], meta: buildMeta(page, limit, total) };
    }

    const rows = await this.prisma.channelMedia.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r));

    return {
      data: ordered.map(toMediaItem),
      meta: buildMeta(page, limit, total),
    };
  }

  async findOne(id: number): Promise<MediaItem> {
    const row = await this.prisma.channelMedia.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Media item ${id} not found`);
    }
    return toMediaItem(row);
  }
}
