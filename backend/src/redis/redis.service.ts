import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin wrapper around ioredis used as a best-effort response cache
 * (see MediaService). Every operation swallows its own errors and logs a
 * single warning the first time something goes wrong — a Redis outage must
 * degrade callers straight to Postgres, never throw / break a request (per
 * API_CONTRACT.md "Redis caching").
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private warnedOnce = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL not set — response caching disabled, all requests will hit Postgres directly.');
      return;
    }

    const client = new Redis(url, {
      // Fail fast per-command instead of queueing indefinitely while
      // disconnected — combined with the try/catch in every method below,
      // this is what keeps a Redis outage from ever hanging a request.
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 5000),
    });
    client.on('error', (error) => this.warnOnce(error));
    this.client = client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.warnOnce(error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.warnOnce(error);
    }
  }

  /** Best-effort single-key invalidation (used by the gramjs->bot migration when it rewrites a row's fileId). */
  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (error) {
      this.warnOnce(error);
    }
  }

  private warnOnce(error: unknown): void {
    if (this.warnedOnce) return;
    this.warnedOnce = true;
    this.logger.warn(
      `Redis error — falling back to Postgres directly for cached reads until recovered (further Redis errors suppressed): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
