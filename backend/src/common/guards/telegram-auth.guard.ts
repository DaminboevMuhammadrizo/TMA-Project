import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { TelegramAuthedRequest } from '../middleware/telegram-auth.middleware';

/**
 * Guards endpoints that require a known Telegram user (favorites), per
 * API_CONTRACT.md: 401 if `x-telegram-init-data` is missing or invalid.
 * Relies on TelegramAuthMiddleware (applied globally in AppModule) having
 * already validated the header and stashed the result on the request.
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TelegramAuthedRequest>();
    if (!request.telegramUserId) {
      throw new UnauthorizedException('Missing or invalid x-telegram-init-data header');
    }
    return true;
  }
}
