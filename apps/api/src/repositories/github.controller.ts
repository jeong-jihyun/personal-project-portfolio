import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { githubImportSchema, type UserDto } from '@ppp/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { GithubService } from './github.service.js';

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/github')
export class GithubController {
  constructor(@Inject(GithubService) private readonly github: GithubService) {}

  /** 내 GitHub 저장소 목록 (공개+비공개, 등록 여부 포함) */
  @Get('repos')
  list(@CurrentUser() user: UserDto) {
    return this.github.list(user.id);
  }

  /** 선택한 저장소 등록. projectId 를 비우면 새 프로젝트(비공개·비게시)를 만든다. */
  @Post('import')
  @ApiZodBody(githubImportSchema)
  import(@CurrentUser() user: UserDto, @Body(new ZodPipe(githubImportSchema)) body: z.output<typeof githubImportSchema>) {
    return this.github.import(user.id, body);
  }
}
