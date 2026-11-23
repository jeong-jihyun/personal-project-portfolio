import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module.js';
import { DashboardController } from '../dashboard/dashboard.controller.js';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { SkillsController } from '../skills/skills.controller.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [ActivityModule],
  controllers: [ProjectsController, DashboardController, SkillsController],
  providers: [ProjectsService, DashboardService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
