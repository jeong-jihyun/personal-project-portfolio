import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { ScreenshotsController } from './screenshots.controller.js';
import { ScreenshotsService } from './screenshots.service.js';

@Module({
  imports: [ActivityModule, ProjectsModule],
  controllers: [ScreenshotsController],
  providers: [ScreenshotsService],
})
export class ScreenshotsModule {}
