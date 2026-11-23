/** `pnpm db:seed` — 마이그레이션 후 소유자 계정과 예시 데이터를 만든다. */
import { createDatabase, databaseOptionsFromEnv } from './database.js';
import { seed } from './seed.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error('[seed] ADMIN_EMAIL 과 ADMIN_PASSWORD 환경 변수를 설정하세요 (.env.example 참고).');
  process.exit(1);
}
if (password.length < 10) {
  console.error('[seed] ADMIN_PASSWORD 는 10자 이상이어야 합니다.');
  process.exit(1);
}

const handle = await createDatabase(databaseOptionsFromEnv());
try {
  await handle.migrate();
  const result = await seed(handle.db, {
    email,
    password,
    displayName: process.env.ADMIN_DISPLAY_NAME,
    withSampleData: process.env.SEED_SAMPLE_DATA !== 'false',
  });
  console.log(result.created ? `[seed] owner created: ${email}` : `[seed] owner already exists: ${email} (skipped)`);
} finally {
  await handle.close();
}
