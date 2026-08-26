import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Prisma returns `bigint` for BigInt columns (messageId, replyToMessageId).
 * Express's res.json() calls JSON.stringify under the hood, which throws on
 * `bigint` values ("Do not know how to serialize a BigInt"). This interceptor
 * walks every outgoing response body and converts bigint -> number, so
 * controllers/mappers don't have to remember to do it everywhere by hand.
 *
 * (Media responses are already mapped to plain numbers explicitly in
 * MediaItemMapper; this interceptor is the global safety net for anything
 * that isn't.)
 */
@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((body) => convertBigInts(body)));
  }
}

function convertBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (Array.isArray(value)) {
    return value.map(convertBigInts);
  }
  if (value instanceof Date) {
    return value;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = convertBigInts(val);
    }
    return result;
  }
  return value;
}
