/** F-005 경력 관리 */
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { and, asc, desc, eq } from 'drizzle-orm';
import { careerSchema, careerUpdateSchema, type CareerDto, type UserDto } from '@ppp/shared';
import type { z } from 'zod';
import { ActivityService } from '../activity/activity.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { badRequest, notFound } from '../common/errors.js';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { DB } from '../common/tokens.js';
import { UuidPipe, ZodPipe } from '../common/zod.pipe.js';
import type { Database } from '../db/database.js';
import { careers } from '../db/schema.js';

type Row = typeof careers.$inferSelect;
const toDto = (c: Row): CareerDto => ({
  id: c.id,
  company: c.company,
  position: c.position,
  startDate: c.startDate,
  endDate: c.endDate,
  description: c.description,
  visibility: c.visibility,
  displayOrder: c.displayOrder,
});

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/careers')
export class CareersController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  /** 최근 경력이 위로 (표시 순서 → 시작일 내림차순) */
  @Get()
  async list(@CurrentUser() user: UserDto): Promise<{ items: CareerDto[] }> {
    const rows = await this.db
      .select()
      .from(careers)
      .where(eq(careers.ownerId, user.id))
      .orderBy(asc(careers.displayOrder), desc(careers.startDate));
    return { items: rows.map(toDto) };
  }

  @Post()
  @ApiZodBody(careerSchema)
  async create(@CurrentUser() user: UserDto, @Body(new ZodPipe(careerSchema)) body: z.output<typeof careerSchema>): Promise<CareerDto> {
    const row = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(careers)
        .values({ ...body, ownerId: user.id, endDate: body.endDate ?? null, description: body.description ?? null })
        .returning();
      await this.activity.log(
        { actorId: user.id, entityType: 'CAREER', entityId: created!.id, action: 'CREATE', summary: `경력 등록: ${created!.company}` },
        tx,
      );
      return created!;
    });
    return toDto(row);
  }

  @Patch(':careerId')
  @ApiZodBody(careerUpdateSchema)
  async update(
    @CurrentUser() user: UserDto,
    @Param('careerId', UuidPipe) id: string,
    @Body(new ZodPipe(careerUpdateSchema)) body: z.output<typeof careerUpdateSchema>,
  ): Promise<CareerDto> {
    const current = await this.findOwned(user.id, id);
    const start = body.startDate ?? current.startDate;
    const end = body.endDate !== undefined ? body.endDate : current.endDate;
    if (end && end < start) {
      throw badRequest('VALIDATION_ERROR', '입력값을 확인하세요.', [{ path: 'endDate', message: '종료일은 시작일보다 빠를 수 없습니다.' }]);
    }
    const values = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    const row = await this.db.transaction(async (tx) => {
      const [updated] = await tx.update(careers).set({ ...values, updatedAt: new Date() }).where(eq(careers.id, id)).returning();
      await this.activity.log(
        { actorId: user.id, entityType: 'CAREER', entityId: id, action: 'UPDATE', summary: `경력 수정: ${updated!.company}` },
        tx,
      );
      return updated!;
    });
    return toDto(row);
  }

  @Delete(':careerId')
  @HttpCode(204)
  async remove(@CurrentUser() user: UserDto, @Param('careerId', UuidPipe) id: string): Promise<void> {
    const current = await this.findOwned(user.id, id);
    await this.db.transaction(async (tx) => {
      await tx.delete(careers).where(eq(careers.id, id));
      await this.activity.log(
        { actorId: user.id, entityType: 'CAREER', entityId: id, action: 'DELETE', summary: `경력 삭제: ${current.company}` },
        tx,
      );
    });
  }

  private async findOwned(ownerId: string, id: string): Promise<Row> {
    const [row] = await this.db.select().from(careers).where(and(eq(careers.id, id), eq(careers.ownerId, ownerId)));
    if (!row) throw notFound('경력');
    return row;
  }
}

