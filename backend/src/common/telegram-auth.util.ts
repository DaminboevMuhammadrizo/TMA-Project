import { createHmac } from 'crypto';

const REPLAY_WINDOW_SECONDS = 24 * 60 * 60; // 24h, per API_CONTRACT.md

export interface TelegramAuthResult {
  userId: bigint;
}

/**
 * Validates a raw `window.Telegram.WebApp.initData` string against BOT_TOKEN,
 * per the algorithm documented in API_CONTRACT.md ("Telegram WebApp auth")
 * and https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app.
 *
 * Pure function, no NestJS/DI dependency, so it's trivial to unit test.
 * Returns null for absent/malformed input, a bad hash, or a replayed
 * (>24h old) auth_date — callers decide whether that's a hard failure
 * (401, for favorites) or a graceful "anonymous" fallback (media endpoints).
 */
export function validateTelegramInitData(
  initData: string | undefined | null,
  botToken: string | undefined | null,
): TelegramAuthResult | null {
  if (!initData || !botToken) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const keys = Array.from(new Set(params.keys())).sort();
  const dataCheckString = keys.map((key) => `${key}=${params.get(key) ?? ''}`).join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) return null;

  const authDateRaw = params.get('auth_date');
  const authDate = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isFinite(authDate)) return null;
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > REPLAY_WINDOW_SECONDS) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as { id?: number };
    if (typeof user.id !== 'number' || !Number.isFinite(user.id)) return null;
    return { userId: BigInt(user.id) };
  } catch {
    return null;
  }
}
