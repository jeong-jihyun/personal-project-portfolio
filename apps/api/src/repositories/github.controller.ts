import { Body, Controller, Get, Headers, Inject, Post, UseGuards } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { asc } from 'drizzle-orm';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { githubImportSchema, type UserDto } from '@ppp/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { unauthorized } from '../common/errors.js';
import { DB } from '../common/tokens.js';
import type { Database } from '../db/database.js';
import { users } from '../db/schema.js';
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

  /** 지금 동기화 (목록을 열 때 화면이 자동으로 부르고, 버튼으로도 부른다) */
  @Post('sync')
  sync(@CurrentUser() user: UserDto) {
    return this.github.sync(user.id);
  }

  /** 선택한 저장소 등록. projectId 를 비우면 새 프로젝트(비공개·비게시)를 만든다. */
  @Post('import')
  @ApiZodBody(githubImportSchema)
  import(@CurrentUser() user: UserDto, @Body(new ZodPipe(githubImportSchema)) body: z.output<typeof githubImportSchema>) {
    return this.github.import(user.id, body);
  }
}

/** 하루 1번 자동 동기화 (Vercel Cron → GET, Authorization: Bearer CRON_SECRET). 소유자 계정 기준. */
@ApiTags('cron')
@Controller('cron')
export class GithubCronController {
  constructor(
    @Inject(GithubService) private readonly github: GithubService,
    @Inject(DB) private readonly db: Database,
  ) {}

  @Get('github-sync')
  async run(@Headers('authorization') auth: string | undefined) {
    const secret = (process.env.CRON_SECRET ?? '').trim();
    const given = Buffer.from(auth ?? '');
    const expected = Buffer.from(`Bearer ${secret}`);
    if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) throw unauthorized();
    const [owner] = await this.db.select({ id: users.id }).from(users).orderBy(asc(users.createdAt)).limit(1);
    if (!owner) return { skipped: 'no owner' };
    const r = await this.github.sync(owner.id);
    return { total: r.total, created: r.created, updated: r.updated, errors: r.errors.length, syncedAt: r.syncedAt };
  }
}
