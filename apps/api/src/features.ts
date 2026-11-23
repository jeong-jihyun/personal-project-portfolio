/** 도메인 모듈 목록 (Modular Monolith). */
import type { Type } from '@nestjs/common';
import { ActivityModule } from './activity/activity.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';

export const FEATURE_MODULES: Type[] = [ActivityModule, AuthModule, ProjectsModule];
