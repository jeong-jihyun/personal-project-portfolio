/** Nest 애플리케이션 생성. main.ts와 테스트가 공유한다. */
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express, { type Request, type Response, type NextFunction } from 'express';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config.js';
import type { DatabaseHandle } from './db/database.js';
import { originCheckMiddleware, securityHeadersMiddleware, traceMiddleware } from './common/http.js';

export const API_PREFIX = 'api/v1';

export interface CreateAppOptions {
  config: AppConfig;
  database: DatabaseHandle;
  logger?: boolean;
}

export async function createApp({ config, database, logger = true }: CreateAppOptions): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config, database), {
    logger: logger ? ['log', 'warn', 'error'] : false,
    bodyParser: false,
  });

  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy', 1);
  app.use(traceMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '256kb' }));
  app.use(bodyParserErrorHandler);
  app.use(cookieParser());
  // 관리자·로그인 응답은 브라우저·CDN에 저장하지 않는다 (저장 직후 새로고침에 옛 값이 보이지 않게)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith(`/${API_PREFIX}/admin`) || req.path.startsWith(`/${API_PREFIX}/auth`)) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(originCheckMiddleware(config.allowedOrigins));
  app.enableCors({ origin: config.allowedOrigins, credentials: true });
  app.setGlobalPrefix(API_PREFIX);

  const openapi = new DocumentBuilder()
    .setTitle('Personal Project Portfolio API')
    .setDescription('Admin(/admin) · Public(/public) · Auth(/auth) — API 설계서 v2.0')
    .setVersion('2.0')
    .addCookieAuth('pps_session')
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, openapi), {
    jsonDocumentUrl: 'api/docs/openapi.json',
  });

  if (config.serveWeb) mountWebApps(app);
  return app;
}

/**
 * 빌드된 웹 앱 제공: /admin → Admin Web, /portfolio → Public Web, / → /portfolio.
 * 개발 중에는 각 Vite 개발 서버를 사용한다.
 */
function mountWebApps(app: NestExpressApplication): void {
  const appsDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
  const http = app.getHttpAdapter().getInstance() as express.Express;
  const mounts: [string, string][] = [
    ['/admin', path.join(appsDir, 'admin-web', 'dist')],
    ['/portfolio', path.join(appsDir, 'public-web', 'dist')],
  ];
  for (const [base, dir] of mounts) {
    const index = path.join(dir, 'index.html');
    if (!existsSync(index)) continue;
    http.use(base, express.static(dir, { index: false, maxAge: '1h' }));
    http.use(base, (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || path.extname(req.path)) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
    });
  }
  http.get('/', (_req: Request, res: Response) => res.redirect(302, '/portfolio/'));
}

/** JSON 파싱·크기 초과 오류를 표준 오류 응답으로 변환 */
function bodyParserErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const e = err as { type?: string; status?: number } | undefined;
  if (!e || typeof e.type !== 'string') return next(err);
  const tooLarge = e.type === 'entity.too.large';
  res.status(tooLarge ? 413 : 400).json({
    code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
    message: tooLarge ? '요청 본문이 너무 큽니다.' : '요청 본문이 올바른 JSON이 아닙니다.',
    traceId: req.traceId ?? 'unknown',
  });
}
