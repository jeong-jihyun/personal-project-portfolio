/**
 * Vercel 빌드 (Build Output API v3).
 *   1) 공용 패키지 빌드
 *   2) DATABASE_URL이 있으면 마이그레이션·시드 적용 (apps/api db:deploy)
 *   3) API를 단일 서버리스 함수로 번들 → .vercel/output/functions/api.func
 *   4) 빌드된 웹 앱이 있으면 정적 파일로 배치 → /admin, /portfolio
 * 로컬 확인: `pnpm vercel-build` 후 .vercel/output 구조를 보면 된다.
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.vercel', 'output');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit', env: process.env });

// 함수 리전: DB와 가까운 곳으로 (기본 icn1 = 서울)
const REGION = process.env.FUNCTION_REGION || 'icn1';

rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, 'static'), { recursive: true });

console.log('▶ build shared package');
run('pnpm --filter @ppp/shared build');

console.log('▶ database migrations / seed');
run('pnpm --filter @ppp/api db:deploy');

// ── API 함수 번들 ─────────────────────────────────
console.log('▶ bundle API function');
const apiDir = path.join(root, 'apps', 'api');
const requireFromApi = createRequire(path.join(apiDir, 'package.json'));
const esbuild = await import('esbuild');
const funcDir = path.join(out, 'functions', 'api.func');
mkdirSync(funcDir, { recursive: true });

// Nest가 선택적으로 require하는 패키지와 런타임에 쓰지 않는 드라이버는 번들에서 제외한다.
const external = [
  '@nestjs/microservices',
  '@nestjs/microservices/*',
  '@nestjs/websockets',
  '@nestjs/websockets/*',
  '@fastify/static',
  'class-validator',
  'class-transformer',
  'class-transformer/*',
  'pg-native',
  // 로컬 전용 PGlite 드라이버: 운영(DATABASE_URL)에서는 불러오지 않으므로 어댑터까지 함께 제외한다.
  '@electric-sql/pglite',
  '@electric-sql/pglite/*',
  'drizzle-orm/pglite',
  'drizzle-orm/pglite/*',
  'swagger-ui-dist',
];

await esbuild.build({
  entryPoints: [path.join(apiDir, 'src', 'vercel.ts')],
  outfile: path.join(funcDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  tsconfig: path.join(apiDir, 'tsconfig.json'),
  external,
  logLevel: 'warning',
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __fu } from 'node:url';",
      "import { dirname as __dn } from 'node:path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __fu(import.meta.url);',
      'const __dirname = __dn(__filename);',
    ].join('\n'),
  },
});

// Swagger UI 정적 자산은 파일 시스템에서 제공되므로 패키지 폴더를 함께 복사한다.
const swaggerDir = path.dirname(requireFromApi.resolve('swagger-ui-dist/package.json', { paths: [path.dirname(requireFromApi.resolve('@nestjs/swagger'))] }));
cpSync(swaggerDir, path.join(funcDir, 'node_modules', 'swagger-ui-dist'), { recursive: true, dereference: true });

writeFileSync(path.join(funcDir, 'package.json'), JSON.stringify({ type: 'module' }));
writeFileSync(
  path.join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      maxDuration: 30,
      regions: [REGION],
    },
    null,
    2,
  ),
);

// ── 웹 앱 정적 파일 ───────────────────────────────
const webApps = [
  ['admin-web', 'admin'],
  ['public-web', 'portfolio'],
];
const spaRoutes = [];
for (const [pkg, base] of webApps) {
  const pkgJson = path.join(root, 'apps', pkg, 'package.json');
  if (!existsSync(pkgJson)) continue;
  console.log(`▶ build ${pkg}`);
  run(`pnpm --filter @ppp/${pkg} build`);
  cpSync(path.join(root, 'apps', pkg, 'dist'), path.join(out, 'static', base), { recursive: true });
  spaRoutes.push({ src: `^/${base}(?:/.*)?$`, dest: `/${base}/index.html` });
}

// ── 라우팅 ────────────────────────────────────────
const routes = [
  { src: '^/api/(.*)$', dest: '/api' },
  { src: '^/$', status: 302, headers: { Location: spaRoutes.length ? '/portfolio/' : '/api/v1/health' } },
  { handle: 'filesystem' },
  ...spaRoutes,
];
writeFileSync(path.join(out, 'config.json'), JSON.stringify({ version: 3, routes }, null, 2));
console.log('✔ .vercel/output ready');
