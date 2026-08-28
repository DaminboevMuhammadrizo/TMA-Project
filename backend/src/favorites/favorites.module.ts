import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { TelegramAuthGuard } from '../common/guards/telegram-auth.guard';

@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService, TelegramAuthGuard],
})
export class FavoritesModule {}
