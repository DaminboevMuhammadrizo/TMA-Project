import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaFileService } from './media-file.service';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [SyncModule],
  controllers: [MediaController],
  providers: [MediaService, MediaFileService],
})
export class MediaModule {}
