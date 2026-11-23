/**
 * Vercel 서버리스 함수 진입점. 콜드 스타트 때 Nest 앱을 한 번 만들고 이후 요청에 재사용한다.
 * 운영 환경에서는 DATABASE_URL(PostgreSQL)이 필수다. 마이그레이션은 빌드 단계(db:deploy)에서 적용한다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/database.js';

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

let handlerPromise: Promise<Handler> | undefined;

async function bootstrap(): Promise<Handler> {
  const config = { ...loadConfig(), serveWeb: false, migrateOnStart: false };
  const database = await createDatabase(config.database);
  const app = await createApp({ config, database });
  await app.init();
  return app.getHttpAdapter().getInstance() as Handler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!process.env.DATABASE_URL) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({ code: 'DB_NOT_CONFIGURED', message: 'DATABASE_URL이 설정되지 않았습니다.', traceId: 'bootstrap' }),
    );
    return;
  }
  handlerPromise ??= bootstrap().catch((err) => {
    handlerPromise = undefined;
    throw err;
  });
  const app = await handlerPromise;
  app(req, res);
}
