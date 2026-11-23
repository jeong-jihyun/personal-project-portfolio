/**
 * DB 연결 팩토리.
 * - DATABASE_URL(postgres://...)이 있으면 node-postgres로 실제 PostgreSQL에 연결한다.
 * - 없으면 PGlite(WASM PostgreSQL)를 사용한다: PGLITE_DATA_DIR 디렉터리에 영속 저장, 'memory://'는 테스트용 메모리 DB.
 * 두 드라이버 모두 동일한 Drizzle PostgreSQL 방언과 마이그레이션을 사용한다.
 */
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { schema } from './schema.js';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseHandle {
  db: Database;
  driver: 'postgres' | 'pglite';
  migrate(): Promise<void>;
  close(): Promise<void>;
}

export interface DatabaseOptions {
  databaseUrl?: string;
  pgliteDataDir?: string;
  /** 서버리스 환경에서는 작게(1~3) 유지한다. */
  poolMax?: number;
}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function createDatabase(options: DatabaseOptions): Promise<DatabaseHandle> {
  if (options.databaseUrl) {
    const { Pool } = (await import('pg')).default;
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const pool = new Pool({ connectionString: options.databaseUrl, max: options.poolMax ?? 10 });
    const db = drizzle(pool, { schema });
    return {
      db: db as unknown as Database,
      driver: 'postgres',
      migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_DIR }),
      close: () => pool.end(),
    };
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const dataDir = options.pgliteDataDir ?? 'memory://';
  if (!dataDir.startsWith('memory://')) {
    mkdirSync(path.resolve(dataDir), { recursive: true });
  }
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  return {
    db: db as unknown as Database,
    driver: 'pglite',
    migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_DIR }),
    close: () => client.close(),
  };
}

/** 환경 변수에서 DB 옵션을 읽는다. */
export function databaseOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): DatabaseOptions {
  return {
    databaseUrl: env.DATABASE_URL || undefined,
    poolMax: env.DB_POOL_MAX ? Number(env.DB_POOL_MAX) : undefined,
    pgliteDataDir: env.PGLITE_DATA_DIR || path.resolve(fileURLToPath(new URL('../../../../.data/pglite', import.meta.url))),
  };
}
