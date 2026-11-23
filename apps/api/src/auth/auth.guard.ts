import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { unauthorized } from '../common/errors.js';
import { AuthService, SESSION_COOKIE } from './auth.service.js';

/**
 * 모든 Admin endpoint에 적용: 인증된 사용자만 통과시키고 req.user를 채운다.
 * 리소스 소유권은 각 서비스가 ownerId 조건으로 확인한다 (남의 리소스는 404로 응답해 존재 여부를 숨긴다).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = await this.auth.userForToken(req.cookies?.[SESSION_COOKIE]);
    if (!user) throw unauthorized();
    req.user = user;
    return true;
  }
}
