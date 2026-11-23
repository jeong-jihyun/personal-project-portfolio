import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { repositoryCreateSchema, repositoryUpdateSchema, VISIBILITIES, type UserDto } from '@ppp/shared';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { UuidPipe, ZodPipe } from '../common/zod.pipe.js';
import { RepositoriesService } from './repositories.service.js';

const listAllQuery = z.object({
  projectId: z.uuid().optional(),
  visibility: z.enum(VISIBILITIES).optional(),
});

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin')
export class RepositoriesController {
  constructor(@Inject(RepositoriesService) private readonly repos: RepositoriesService) {}

  /** ADM-05 전체 저장소 (선택: projectId, visibility) */
  @Get('repositories')
  async listAll(@CurrentUser() user: UserDto, @Query(new ZodPipe(listAllQuery)) q: z.output<typeof listAllQuery>) {
    return { items: await this.repos.listAll(user.id, q) };
  }

  @Get('projects/:projectId/repositories')
  async list(@CurrentUser() user: UserDto, @Param('projectId', UuidPipe) projectId: string) {
    return { items: await this.repos.listForProject(user.id, projectId) };
  }

  @Post('projects/:projectId/repositories')
  @ApiZodBody(repositoryCreateSchema)
  create(
    @CurrentUser() user: UserDto,
    @Param('projectId', UuidPipe) projectId: string,
    @Body(new ZodPipe(repositoryCreateSchema)) body: z.output<typeof repositoryCreateSchema>,
  ) {
    return this.repos.create(user.id, projectId, body);
  }

  @Patch('repositories/:repositoryId')
  @ApiZodBody(repositoryUpdateSchema)
  update(
    @CurrentUser() user: UserDto,
    @Param('repositoryId', UuidPipe) id: string,
    @Body(new ZodPipe(repositoryUpdateSchema)) body: z.output<typeof repositoryUpdateSchema>,
  ) {
    return this.repos.update(user.id, id, body);
  }

  @Delete('repositories/:repositoryId')
  @HttpCode(204)
  remove(@CurrentUser() user: UserDto, @Param('repositoryId', UuidPipe) id: string) {
    return this.repos.remove(user.id, id);
  }
}
