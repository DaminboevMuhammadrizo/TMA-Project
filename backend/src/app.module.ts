import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MediaModule } from './media/media.module';
import { SyncModule } from './sync/sync.module';
import { FavoritesModule } from './favorites/favorites.module';
import { TelegramAuthMiddleware } from './common/middleware/telegram-auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    SyncModule,
    MediaModule,
    FavoritesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Validates x-telegram-init-data (if present) once per request and
    // stashes the result for TelegramAuthGuard / @TelegramUser() to read —
    // see src/common/middleware/telegram-auth.middleware.ts.
    consumer.apply(TelegramAuthMiddleware).forRoutes('*');
  }
}
