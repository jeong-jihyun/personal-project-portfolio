/** 도메인 모듈 목록 (Modular Monolith). */
import type { Type } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { PublicModule } from './public/public.module.js';
import { RepositoriesModule } from './repositories/repositories.module.js';
import { ScreenshotsModule } from './screenshots/screenshots.module.js';
import { StorageModule } from './storage/storage.module.js';

export const FEATURE_MODULES: Type[] = [StorageModule, ActivityModule, AuthModule, ProjectsModule, RepositoriesModule, ScreenshotsModule, PublicModule];
