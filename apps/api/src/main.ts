import { Logger } from '@nestjs/common';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './db/database.js';
import { seed } from './db/seed.js';

const logger = new Logger('Bootstrap');
const config = loadConfig();
const database = await createDatabase(config.database);

try {
  if (config.migrateOnStart) await database.migrate();
} catch (err) {
  if (database.driver === 'pglite') {
    // 로컬 PGlite 파일은 서버를 강제 종료하면 손상될 수 있다 (운영 DB와 무관).
    logger.error(
      '로컬 DB(.data/pglite)를 열 수 없습니다. 서버가 강제 종료되며 손상된 것으로 보입니다.\n' +
        '  해결: pnpm db:reset  (로컬 테스트 DB만 다시 만듭니다)\n' +
        '  또는: pnpm dev:memory (파일 없이 메모리 DB로 실행)',
    );
  }
  throw err;
}

// 개발 편의: 메모리 DB 등에서 시작할 때 소유자 계정·예시 데이터를 자동으로 넣는다.
if (process.env.SEED_ON_START === 'true' && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const r = await seed(database.db, {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    displayName: process.env.ADMIN_DISPLAY_NAME,
    withSampleData: process.env.SEED_SAMPLE_DATA !== 'false',
  });
  if (r.created) logger.log(`seeded owner account: ${process.env.ADMIN_EMAIL}`);
}

const app = await createApp({ config, database });
app.enableShutdownHooks();
await app.listen(config.port);

logger.log(`API listening on http://localhost:${config.port}/api/v1 (db: ${database.driver})`);
logger.log(`OpenAPI docs: http://localhost:${config.port}/api/docs`);

const shutdown = async () => {
  await app.close();
  await database.close();
  process.exit(0);
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
