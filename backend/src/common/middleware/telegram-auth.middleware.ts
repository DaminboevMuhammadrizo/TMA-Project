import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { validateTelegramInitData } from '../telegram-auth.util';

/** Augments Express's Request with the outcome of Telegram initData validation, set by TelegramAuthMiddleware. */
export interface TelegramAuthedRequest extends Request {
  telegramUserId?: bigint | null;
}

/**
 * Runs on every request, validates the optional `x-telegram-init-data`
 * header once, and stashes the result on the request object. Never rejects
 * a request itself — `TelegramAuthGuard` (required, e.g. favorites) and
 * `@TelegramUser()` (optional, e.g. media endpoints) both read the stashed
 * value instead of re-parsing the header.
 */
@Injectable()
export class TelegramAuthMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: TelegramAuthedRequest, _res: Response, next: NextFunction): void {
    const initData = req.header('x-telegram-init-data');
    const botToken = this.config.get<string>('BOT_TOKEN');
    const result = validateTelegramInitData(initData, botToken);
    req.telegramUserId = result ? result.userId : null;
    next();
  }
}
