/** 환경 변수 → 애플리케이션 설정. */
import { databaseOptionsFromEnv, type DatabaseOptions } from './db/database.js';

export interface AppConfig {
  port: number;
  production: boolean;
  database: DatabaseOptions;
  migrateOnStart: boolean;
  allowedOrigins: string[];
  sessionTtlHours: number;
  cookieSecure: boolean;
  /** 빌드된 Admin/Public 웹 정적 파일을 API 서버가 함께 제공할지 여부 */
  serveWeb: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === 'production';
  return {
    port: Number(env.PORT ?? 3000),
    production,
    database: databaseOptionsFromEnv(env),
    migrateOnStart: (env.MIGRATE_ON_START ?? 'true') !== 'false',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    sessionTtlHours: Math.max(1, Number(env.SESSION_TTL_HOURS ?? 12)),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : production,
    serveWeb: (env.SERVE_WEB ?? 'true') !== 'false',
  };
}
