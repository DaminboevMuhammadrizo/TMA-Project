import { Module } from '@nestjs/common';
import { MediaSyncService } from './media-sync.service';
import { GramjsService } from './gramjs.service';
import { BotService } from './bot.service';
import { MigrationService } from './migration.service';
import { SyncController } from './sync.controller';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';

@Module({
  controllers: [SyncController],
  providers: [MediaSyncService, GramjsService, BotService, MigrationService, AdminTokenGuard],
  exports: [MediaSyncService, GramjsService, BotService],
})
export class SyncModule {}
