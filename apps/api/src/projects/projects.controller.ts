import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import {
  listQuerySchema,
  projectCreateSchema,
  projectUpdateSchema,
  publicationSchema,
  type ListQuery,
  type PublicationInput,
  type UserDto,
} from '@ppp/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { UuidPipe, ZodPipe } from '../common/zod.pipe.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/projects')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  /** 목록: page, pageSize, sort(updatedAt|createdAt|title|startDate|sortOrder), order, q, status, visibility */
  @Get()
  list(@CurrentUser() user: UserDto, @Query(new ZodPipe(listQuerySchema)) query: ListQuery) {
    return this.projects.list(user.id, query);
  }

  @Post()
  @ApiZodBody(projectCreateSchema)
  create(@CurrentUser() user: UserDto, @Body(new ZodPipe(projectCreateSchema)) body: z.output<typeof projectCreateSchema>) {
    return this.projects.create(user.id, body);
  }

  @Get(':projectId')
  get(@CurrentUser() user: UserDto, @Param('projectId', UuidPipe) id: string) {
    return this.projects.get(user.id, id);
  }

  @Patch(':projectId')
  @ApiZodBody(projectUpdateSchema)
  update(
    @CurrentUser() user: UserDto,
    @Param('projectId', UuidPipe) id: string,
    @Body(new ZodPipe(projectUpdateSchema)) body: z.output<typeof projectUpdateSchema>,
  ) {
    return this.projects.update(user.id, id, body);
  }

  /** 게시 설정: { publicationStatus?, visibility?, isFeatured? } */
  @Patch(':projectId/publication')
  @ApiZodBody(publicationSchema)
  publication(
    @CurrentUser() user: UserDto,
    @Param('projectId', UuidPipe) id: string,
    @Body(new ZodPipe(publicationSchema)) body: PublicationInput,
  ) {
    return this.projects.setPublication(user.id, id, body);
  }

  /** 삭제 전 연관 데이터 영향 안내 (UI 설계서 §6) */
  @Get(':projectId/delete-impact')
  deleteImpact(@CurrentUser() user: UserDto, @Param('projectId', UuidPipe) id: string) {
    return this.projects.deleteImpact(user.id, id);
  }

  @Delete(':projectId')
  @HttpCode(204)
  remove(@CurrentUser() user: UserDto, @Param('projectId', UuidPipe) id: string) {
    return this.projects.remove(user.id, id);
  }
}
