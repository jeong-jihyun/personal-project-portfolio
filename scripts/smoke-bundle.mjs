/**
 * 배포 번들 스모크 테스트: `pnpm vercel-build` 결과물(.vercel/output/functions/api.func)을
 * 실제 PostgreSQL 프로토콜(PGlite 소켓 서버)에 연결해 Vercel과 같은 방식으로 호출한다.
 *   node scripts/smoke-bundle.mjs
 */
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromApi = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const { PGlite } = await import(pathToFileURL(requireFromApi.resolve('@electric-sql/pglite')).href);
const { PGLiteSocketServer } = await import(pathToFileURL(requireFromApi.resolve('@electric-sql/pglite-socket')).href);

const PG_PORT = 54329;
const HTTP_PORT = 3999;
const db = await PGlite.create();
const pgServer = new PGLiteSocketServer({ db, port: PG_PORT, host: '127.0.0.1' });
await pgServer.start();

const env = {
  ...process.env,
  DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`,
  DB_POOL_MAX: '1',
  ADMIN_EMAIL: 'smoke@example.com',
  ADMIN_PASSWORD: 'smoke-password-123',
  SEED_SAMPLE_DATA: 'true',
};
execSync('pnpm --filter @ppp/api db:deploy', { cwd: root, stdio: 'inherit', env });
Object.assign(process.env, env);

const fn = await import(pathToFileURL(path.join(root, '.vercel/output/functions/api.func/index.mjs')).href);
const http = createServer((req, res) => fn.default(req, res));
await new Promise((r) => http.listen(HTTP_PORT, r));

const base = `http://127.0.0.1:${HTTP_PORT}`;
const checks = [
  ['GET /api/v1/health', `${base}/api/v1/health`, 200],
  ['GET /api/docs/openapi.json', `${base}/api/docs/openapi.json`, 200],
  ['GET /api/docs (Swagger UI)', `${base}/api/docs`, 200],
  ['GET /api/v1/unknown → 404 표준 오류', `${base}/api/v1/unknown`, 404],
];
let failed = 0;
for (const [label, url, expected] of checks) {
  const res = await fetch(url);
  const ok = res.status === expected;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✘'} ${label} → ${res.status}`);
}

http.close();
await pgServer.stop();
await db.close();
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('smoke test passed');
process.exit(0);
