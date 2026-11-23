/** 테스트 공통: 메모리 PGlite + 시드된 소유자 + Nest 앱 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabase, type DatabaseHandle } from '../src/db/database.js';
import { seed } from '../src/db/seed.js';

export const OWNER = { email: 'owner@example.com', password: 'test-password-123' };

export interface TestContext {
  app: NestExpressApplication;
  database: DatabaseHandle;
  http: ReturnType<typeof request>;
  close(): Promise<void>;
}

export async function setupApp(opts: { sampleData?: boolean } = {}): Promise<TestContext> {
  const database = await createDatabase({ pgliteDataDir: 'memory://' });
  await database.migrate();
  await seed(database.db, { ...OWNER, withSampleData: opts.sampleData ?? false });
  const config = { ...loadConfig({}), serveWeb: false, allowedOrigins: ['http://localhost:5173'] };
  const app = await createApp({ config, database, logger: false });
  await app.init();
  return {
    app,
    database,
    http: request(app.getHttpServer()),
    async close() {
      await app.close();
      await database.close();
    },
  };
}

/** 로그인 후 세션 쿠키가 유지되는 agent */
export async function loginAgent(ctx: TestContext, creds = OWNER) {
  const agent = request.agent(ctx.app.getHttpServer());
  const res = await agent.post('/api/v1/auth/session').send(creds);
  if (res.status !== 201 && res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
