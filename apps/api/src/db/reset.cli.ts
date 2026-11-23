/** `pnpm db:reset` — 로컬 PGlite 테스트 DB만 지우고 다시 만든다. DATABASE_URL(실제 DB)이 있으면 거부한다. */
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { createDatabase, databaseOptionsFromEnv } from './database.js';
import { seed } from './seed.js';

const options = databaseOptionsFromEnv();
if (options.databaseUrl) {
  console.error('[db:reset] DATABASE_URL 이 설정되어 있어 중단합니다. 이 명령은 로컬 PGlite 전용입니다.');
  process.exit(1);
}
const dir = path.resolve(options.pgliteDataDir!);
if (!dir.includes(`${path.sep}.data${path.sep}`) && !process.env.PGLITE_DATA_DIR) {
  console.error(`[db:reset] 예상하지 못한 경로라 중단합니다: ${dir}`);
  process.exit(1);
}
await rm(dir, { recursive: true, force: true });
console.log(`[db:reset] removed ${dir}`);

const handle = await createDatabase(options);
try {
  await handle.migrate();
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await seed(handle.db, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      displayName: process.env.ADMIN_DISPLAY_NAME,
      withSampleData: process.env.SEED_SAMPLE_DATA !== 'false',
    });
  }
  console.log('[db:reset] local database recreated and seeded');
} finally {
  await handle.close();
}
