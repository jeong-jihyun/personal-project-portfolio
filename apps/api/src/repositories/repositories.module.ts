import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { GithubController, GithubCronController } from './github.controller.js';
import { GithubService } from './github.service.js';
import { RepositoriesController } from './repositories.controller.js';
import { RepositoriesService } from './repositories.service.js';

@Module({
  imports: [ActivityModule, ProjectsModule],
  controllers: [RepositoriesController, GithubController, GithubCronController],
  providers: [RepositoriesService, GithubService],
})
export class RepositoriesModule {}
