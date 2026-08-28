import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TelegramAuthedRequest } from '../middleware/telegram-auth.middleware';

/**
 * Resolves to the validated Telegram user id (bigint), or `null` if
 * `x-telegram-init-data` was absent/invalid. Never throws — use on endpoints
 * where auth is optional (media list/search/detail, per API_CONTRACT.md).
 * For endpoints where auth is required (favorites), pair with
 * `@UseGuards(TelegramAuthGuard)`, which rejects the request before this
 * decorator ever runs.
 */
export const TelegramUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): bigint | null => {
  const request = ctx.switchToHttp().getRequest<TelegramAuthedRequest>();
  return request.telegramUserId ?? null;
});
