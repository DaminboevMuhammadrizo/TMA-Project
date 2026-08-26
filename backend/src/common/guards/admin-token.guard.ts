import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Simple shared-secret guard for the admin-only /api/sync/* endpoints.
 * Compares the `x-admin-token` request header against ADMIN_TOKEN from env.
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-admin-token');
    const expected = this.config.get<string>('ADMIN_TOKEN');

    if (!expected || !provided || provided !== expected) {
      throw new UnauthorizedException('Invalid or missing x-admin-token header');
    }
    return true;
  }
}
