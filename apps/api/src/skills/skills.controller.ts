/**
 * 기술 목록 조회 (프로젝트 등록 화면의 기술 선택용).
 * 기술 등록·수정·삭제(F-003)는 8단계에서 같은 컨트롤러에 추가한다.
 */
import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { asc, count, eq } from 'drizzle-orm';
import type { SkillDto, UserDto } from '@ppp/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../common/http.js';
import { DB } from '../common/tokens.js';
import type { Database } from '../db/database.js';
import { projectSkills, skills } from '../db/schema.js';

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/skills')
export class SkillsController {
  constructor(@Inject(DB) private readonly db: Database) {}

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
}
