/** 프로필 · 경력 · 산출물 링크 (8단계) */
import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module.js';
import { AssetsController } from '../assets/assets.controller.js';
import { CareersController } from '../careers/careers.controller.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ProfileController } from './profile.controller.js';

@Module({
  imports: [ActivityModule, ProjectsModule],
  controllers: [ProfileController, CareersController, AssetsController],
})
export class ProfileModule {}
