/** 요청 컨텍스트: traceId, 인증 사용자, Origin 검사(CSRF 방어). */
import { randomUUID } from 'node:crypto';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { UserDto } from '@ppp/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      traceId?: string;
      user?: UserDto;
    }
  }
}

const SAFE_TRACE = /^[A-Za-z0-9._-]{8,64}$/;

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.traceId = incoming && SAFE_TRACE.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Trace-Id', req.traceId);
  next();
}

/** 보안 헤더 (정적 웹 포함). */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Swagger UI(/api/docs)는 자체 인라인 스크립트를 쓰므로 CSP 대상에서 제외한다.
  if (!req.path.startsWith('/api/docs')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
  }
  next();
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * 상태 변경 요청의 Origin 검사. 세션 쿠키(SameSite=Lax)와 함께 CSRF를 방어한다.
 * 같은 호스트이거나 ALLOWED_ORIGINS에 있는 Origin만 허용한다. Origin 헤더가 없으면(서버 간 호출, curl) 허용한다.
 */
export function originCheckMiddleware(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!UNSAFE_METHODS.has(req.method)) return next();
    const origin = req.header('origin');
    if (!origin) return next();
    let originHost: string | undefined;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = undefined;
    }
    if (allowedOrigins.includes(origin) || (originHost && originHost === req.header('host'))) return next();
    res.status(403).json({
      code: 'FORBIDDEN_ORIGIN',
      message: '허용되지 않은 출처의 요청입니다.',
      traceId: req.traceId ?? 'unknown',
    });
  };
}

/** 컨트롤러에서 인증된 사용자 주입. AuthGuard가 req.user를 채운다. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): UserDto => {
  return ctx.switchToHttp().getRequest<Request>().user!;
});
