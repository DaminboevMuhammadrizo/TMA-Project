import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { GetFavoritesQueryDto } from './dto/get-favorites-query.dto';
import { MediaItem, PaginatedResponse } from '../media/media-item.mapper';
import { TelegramAuthGuard } from '../common/guards/telegram-auth.guard';
import { TelegramUser } from '../common/decorators/telegram-user.decorator';

/**
 * TelegramAuthGuard guarantees userId is non-null by the time a handler
 * runs (it 401s first) — requireUserId() is a defensive, non-throwing-path
 * assertion only, so the compiler doesn't need `!`/`as bigint` casts sprinkled
 * through every handler.
 */
function requireUserId(userId: bigint | null): bigint {
  if (userId === null) {
    throw new UnauthorizedException('Missing or invalid x-telegram-init-data header');
  }
  return userId;
}

@Controller('favorites')
@UseGuards(TelegramAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findAll(
    @Query() query: GetFavoritesQueryDto,
    @TelegramUser() userId: bigint | null,
  ): Promise<PaginatedResponse<MediaItem>> {
    return this.favoritesService.findAll(requireUserId(userId), query);
  }

  @Post(':mediaId')
  @HttpCode(204)
  add(@Param('mediaId', ParseIntPipe) mediaId: number, @TelegramUser() userId: bigint | null): Promise<void> {
    return this.favoritesService.add(requireUserId(userId), mediaId);
  }

  @Delete(':mediaId')
  @HttpCode(204)
  remove(@Param('mediaId', ParseIntPipe) mediaId: number, @TelegramUser() userId: bigint | null): Promise<void> {
    return this.favoritesService.remove(requireUserId(userId), mediaId);
  }
}
