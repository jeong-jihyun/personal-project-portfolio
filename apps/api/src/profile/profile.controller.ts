/** F-006 프로필: 공개 화면의 이름·소개·연락처. 전체 교체(PUT) 방식. */
import { Body, Controller, Get, Inject, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { careerMarkdownSchema, profileSchema, type ProfileDto, type UserDto } from '@ppp/shared';
import type { z } from 'zod';
import { ActivityService } from '../activity/activity.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { toIso } from '../common/pagination.js';
import { DB } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { Database } from '../db/database.js';
import { profiles, users } from '../db/schema.js';

type Row = typeof profiles.$inferSelect;
const toDto = (p: Row): ProfileDto => ({
  displayName: p.displayName,
  headline: p.headline,
  bio: p.bio,
  contactEmail: p.contactEmail,
  location: p.location,
  links: p.links ?? [],
  publicationStatus: p.publicationStatus,
  careerMarkdown: p.careerMarkdown,
  updatedAt: toIso(p.updatedAt),
});

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/profile')
export class ProfileController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get()
  async get(@CurrentUser() user: UserDto): Promise<ProfileDto> {
    const [p] = await this.db.select().from(profiles).where(eq(profiles.userId, user.id));
    return p
      ? toDto(p)
      : { displayName: user.displayName, headline: null, bio: null, contactEmail: null, location: null, links: [], publicationStatus: 'DRAFT', careerMarkdown: null, updatedAt: null };
  }

  /** 경력 마크다운 저장 (빈 문자열이면 지움 → 공개 화면은 개별 경력 목록으로 돌아감) */
  @Put('career')
  @ApiZodBody(careerMarkdownSchema)
  async putCareer(
    @CurrentUser() user: UserDto,
    @Body(new ZodPipe(careerMarkdownSchema)) body: z.output<typeof careerMarkdownSchema>,
  ): Promise<{ careerMarkdown: string | null }> {
    const markdown = body.markdown.trim() ? body.markdown : null;
    await this.db.transaction(async (tx) => {
      await tx
        .insert(profiles)
        .values({ userId: user.id, displayName: user.displayName, careerMarkdown: markdown })
        .onConflictDoUpdate({ target: profiles.userId, set: { careerMarkdown: markdown, updatedAt: new Date() } });
      await this.activity.log({ actorId: user.id, entityType: 'CAREER', action: 'UPDATE', summary: '경력(마크다운) 저장' }, tx);
    });
    return { careerMarkdown: markdown };
  }

  @Put()
  @ApiZodBody(profileSchema)
  async put(@CurrentUser() user: UserDto, @Body(new ZodPipe(profileSchema)) body: z.output<typeof profileSchema>): Promise<ProfileDto> {
    const values = {
      displayName: body.displayName,
      headline: body.headline ?? null,
      bio: body.bio ?? null,
      contactEmail: body.contactEmail ?? null,
      location: body.location ?? null,
      links: body.links,
      publicationStatus: body.publicationStatus,
      updatedAt: new Date(),
    };
    const row = await this.db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(profiles)
        .values({ userId: user.id, ...values })
        .onConflictDoUpdate({ target: profiles.userId, set: values })
        .returning();
      // 관리자 화면 상단 이름도 함께 맞춘다
      await tx.update(users).set({ displayName: body.displayName }).where(eq(users.id, user.id));
      await this.activity.log({ actorId: user.id, entityType: 'PROFILE', action: 'UPDATE', summary: '프로필 수정' }, tx);
      return saved!;
    });
    return toDto(row);
  }
}
