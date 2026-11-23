/**
 * F-003 키워드(기술) 관리. 키워드는 프로젝트에서 직접 입력해 생기고, 여기서는 정리한다.
 * - 이름 변경: 같은 이름(대소문자 무시)의 다른 키워드가 있으면 하나로 합친다.
 * - 삭제: 프로젝트 연결도 함께 해제된다.
 */
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { and, asc, count, eq, ne, sql } from 'drizzle-orm';
import { normalizeKeyword, SKILL_CATEGORIES, type SkillDto, type UserDto } from '@ppp/shared';
import { z } from 'zod';
import { ActivityService } from '../activity/activity.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { badRequest, notFound } from '../common/errors.js';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { DB } from '../common/tokens.js';
import { UuidPipe, ZodPipe } from '../common/zod.pipe.js';
import type { Database } from '../db/database.js';
import { projectSkills, skills } from '../db/schema.js';

const keywordUpdateSchema = z.object({
  name: z
    .string()
    .transform(normalizeKeyword)
    .pipe(z.string().min(1, '키워드를 입력하세요.').max(40, '40자 이하로 입력하세요.').refine((v) => !/[,<>]/.test(v), '쉼표(,)와 < > 는 쓸 수 없습니다.'))
    .optional(),
  category: z.enum(SKILL_CATEGORIES).optional(),
});

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/skills')
export class SkillsController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get()
  async list(@CurrentUser() user: UserDto): Promise<{ items: SkillDto[] }> {
    const rows = await this.db
      .select({
        id: skills.id,
        name: skills.name,
        category: skills.category,
        proficiencyLabel: skills.proficiencyLabel,
        displayOrder: skills.displayOrder,
        projectCount: count(projectSkills.projectId),
      })
      .from(skills)
      .leftJoin(projectSkills, eq(projectSkills.skillId, skills.id))
      .where(eq(skills.ownerId, user.id))
      .groupBy(skills.id)
      .orderBy(asc(skills.displayOrder), asc(skills.name));
    return { items: rows.map((r) => ({ ...r, projectCount: Number(r.projectCount) })) };
  }

  /** 이름 변경(같은 이름이 있으면 합치기) · 분류 변경. 응답: { merged: 합쳐졌으면 true, item } */
  @Patch(':skillId')
  @ApiZodBody(keywordUpdateSchema)
  async update(
    @CurrentUser() user: UserDto,
    @Param('skillId', UuidPipe) id: string,
    @Body(new ZodPipe(keywordUpdateSchema)) body: z.output<typeof keywordUpdateSchema>,
  ): Promise<{ merged: boolean; id: string }> {
    const current = await this.findOwned(user.id, id);
    if (!body.name && !body.category) throw badRequest('VALIDATION_ERROR', '변경할 내용이 없습니다.');

    return this.db.transaction(async (tx) => {
      if (body.name && body.name.toLowerCase() !== current.name.toLowerCase()) {
        const [target] = await tx
          .select()
          .from(skills)
          .where(and(eq(skills.ownerId, user.id), ne(skills.id, id), sql`lower(${skills.name}) = ${body.name.toLowerCase()}`));
        if (target) {
          // 합치기: 이 키워드의 프로젝트 연결을 대상 키워드로 옮기고 이 키워드는 삭제
          const links = await tx.select({ projectId: projectSkills.projectId }).from(projectSkills).where(eq(projectSkills.skillId, id));
          if (links.length) {
            await tx
              .insert(projectSkills)
              .values(links.map((l) => ({ projectId: l.projectId, skillId: target.id })))
              .onConflictDoNothing();
          }
          await tx.delete(skills).where(eq(skills.id, id));
          await this.activity.log(
            { actorId: user.id, entityType: 'SKILL', entityId: target.id, action: 'UPDATE', summary: `키워드 합치기: #${current.name} → #${target.name}` },
            tx,
          );
          return { merged: true, id: target.id };
        }
      }
      await tx
        .update(skills)
        .set({ ...(body.name ? { name: body.name } : {}), ...(body.category ? { category: body.category } : {}) })
        .where(eq(skills.id, id));
      await this.activity.log(
        {
          actorId: user.id,
          entityType: 'SKILL',
          entityId: id,
          action: 'UPDATE',
          summary: body.name && body.name !== current.name ? `키워드 이름 변경: #${current.name} → #${body.name}` : `키워드 수정: #${current.name}`,
        },
        tx,
      );
      return { merged: false, id };
    });
  }

  @Delete(':skillId')
  @HttpCode(204)
  async remove(@CurrentUser() user: UserDto, @Param('skillId', UuidPipe) id: string): Promise<void> {
    const current = await this.findOwned(user.id, id);
    await this.db.transaction(async (tx) => {
      await tx.delete(skills).where(eq(skills.id, id));
      await this.activity.log({ actorId: user.id, entityType: 'SKILL', entityId: id, action: 'DELETE', summary: `키워드 삭제: #${current.name}` }, tx);
    });
  }

  private async findOwned(ownerId: string, id: string) {
    const [row] = await this.db.select().from(skills).where(and(eq(skills.id, id), eq(skills.ownerId, ownerId)));
    if (!row) throw notFound('키워드');
    return row;
  }
}
