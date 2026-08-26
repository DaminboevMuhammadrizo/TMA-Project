import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../common/guards/admin-token.guard';
import { GramjsService, SyncStatus } from './gramjs.service';

@Controller('sync')
@UseGuards(AdminTokenGuard)
export class SyncController {
  constructor(private readonly gramjsService: GramjsService) {}

  @Post('full')
  @HttpCode(202)
  startFullSync(): { status: 'started' | 'already_running' } {
    const status = this.gramjsService.runFullSync();
    return { status };
  }

  @Get('status')
  getStatus(): Promise<SyncStatus> {
    return this.gramjsService.getStatus();
  }
}
