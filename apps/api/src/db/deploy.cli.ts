/**
 * 배포 빌드 단계에서 실행: 마이그레이션 적용 → (설정된 경우) 소유자 계정 시드.
 * - DATABASE_URL이 없으면 아무것도 하지 않는다(로컬 PGlite에 실수로 쓰지 않도록).
 * - 운영에서는 평문 대신 ADMIN_PASSWORD_HASH(scrypt 해시)를 쓰는 것을 권장한다.
 */
import { createDatabase } from './database.js';
import { seed } from './seed.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('[db:deploy] DATABASE_URL not set — skipping migrations.');
  process.exit(0);
}

const handle = await createDatabase({ databaseUrl });
try {
  await handle.migrate();
  console.log('[db:deploy] migrations applied');

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (email && (password || passwordHash)) {
    const result = await seed(handle.db, {
      email,
      password: password ?? '',
      passwordHash,
      displayName: process.env.ADMIN_DISPLAY_NAME,
      withSampleData: process.env.SEED_SAMPLE_DATA !== 'false',
    });
    console.log(result.created ? '[db:deploy] owner account created' : '[db:deploy] owner account exists (skipped)');
  } else {
    console.log('[db:deploy] ADMIN_EMAIL / ADMIN_PASSWORD_HASH not set — skipping seed.');
  }
} finally {
  await handle.close();
}
