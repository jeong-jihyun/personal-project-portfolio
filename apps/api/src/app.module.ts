import { Global, Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { AppConfig } from './config.js';
import type { DatabaseHandle } from './db/database.js';
import { AllExceptionsFilter } from './common/exception.filter.js';
import { CONFIG, DB } from './common/tokens.js';
import { HealthController } from './health/health.controller.js';
import { FEATURE_MODULES } from './features.js';

/**
 * Modular Monolith 루트 모듈.
 * Admin(/api/v1/admin)·Public(/api/v1/public)·Auth(/api/v1/auth)는 URL 네임스페이스와 가드로 논리 분리한다.
 */
@Global()
@Module({})
export class AppModule {
  static forRoot(config: AppConfig, database: DatabaseHandle): DynamicModule {
    return {
      module: AppModule,
      imports: [...FEATURE_MODULES],
      controllers: [HealthController],
      providers: [
        { provide: CONFIG, useValue: config },
        { provide: DB, useValue: database.db },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
      exports: [CONFIG, DB],
    };
  }
}
