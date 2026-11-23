/** `pnpm db:migrate` — 마이그레이션을 적용한다. */
import { createDatabase, databaseOptionsFromEnv } from './database.js';

const handle = await createDatabase(databaseOptionsFromEnv());
try {
  await handle.migrate();
  console.log(`[db] migrations applied (${handle.driver})`);
} finally {
  await handle.close();
}
