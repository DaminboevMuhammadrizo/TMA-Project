import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MediaService } from './media.service';
import { MediaFileService } from './media-file.service';
import { GetMediaQueryDto } from './dto/get-media-query.dto';
import { SearchMediaQueryDto } from './dto/search-media-query.dto';
import { MediaItem, PaginatedResponse } from './media-item.mapper';
import { TelegramUser } from '../common/decorators/telegram-user.decorator';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly mediaFileService: MediaFileService,
  ) {}

  @Get()
  findAll(
    @Query() query: GetMediaQueryDto,
    @TelegramUser() userId: bigint | null,
  ): Promise<PaginatedResponse<MediaItem>> {
    return this.mediaService.findAll(query, userId);
  }

  @Get('search')
  search(
    @Query() query: SearchMediaQueryDto,
    @TelegramUser() userId: bigint | null,
  ): Promise<PaginatedResponse<MediaItem>> {
    return this.mediaService.search(query, userId);
  }

  @Get('file/:fileUniqueId')
  async getFile(@Param('fileUniqueId') fileUniqueId: string, @Res() res: Response): Promise<void> {
    await this.mediaFileService.streamFile(fileUniqueId, res);
  }

  @Get('thumb/:fileUniqueId')
  async getThumb(@Param('fileUniqueId') fileUniqueId: string, @Res() res: Response): Promise<void> {
    await this.mediaFileService.streamThumb(fileUniqueId, res);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @TelegramUser() userId: bigint | null,
  ): Promise<MediaItem> {
    return this.mediaService.findOne(id, userId);
  }
}
