/** F-004 산출물 링크 (문서·데모·배포 등 외부 URL). 이미지 업로드는 스크린샷 기능이 담당한다. */
import { Body, Controller, Delete, HttpCode, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { and, eq, max, ne } from 'drizzle-orm';
import { assetSchema, assetUpdateSchema, type AssetDto, type UserDto } from '@ppp/shared';
import type { z } from 'zod';
import { ActivityService } from '../activity/activity.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { badRequest, notFound } from '../common/errors.js';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { DB } from '../common/tokens.js';
import { UuidPipe, ZodPipe } from '../common/zod.pipe.js';
import type { Database } from '../db/database.js';
import { assets, projects } from '../db/schema.js';
import { toAssetDto } from '../projects/project.queries.js';
import { ProjectsService } from '../projects/projects.service.js';

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/assets')
export class AssetsController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Post()
  @ApiZodBody(assetSchema)
  async create(@CurrentUser() user: UserDto, @Body(new ZodPipe(assetSchema)) body: z.output<typeof assetSchema>): Promise<AssetDto> {
    if (body.type === 'IMAGE') throw badRequest('VALIDATION_ERROR', '이미지는 스크린샷 올리기로 등록하세요.', [{ path: 'type', message: '이미지는 업로드로 등록합니다.' }]);
    const project = await this.projects.findOwned(user.id, body.projectId);
    const row = await this.db.transaction(async (tx) => {
      const [last] = await tx
        .select({ m: max(assets.displayOrder) })
        .from(assets)
        .where(and(eq(assets.projectId, body.projectId), ne(assets.type, 'IMAGE')));
      const [created] = await tx
        .insert(assets)
        .values({ ...body, displayOrder: body.displayOrder || Number(last?.m ?? 0) + 1 })
        .returning();
      await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, body.projectId));
      await this.activity.log(
        { actorId: user.id, entityType: 'ASSET', entityId: created!.id, action: 'CREATE', summary: `산출물 등록: ${created!.title} (${project.title})` },
        tx,
      );
      return created!;
    });
    return toAssetDto(row);
  }

  @Patch(':assetId')
  @ApiZodBody(assetUpdateSchema)
  async update(
    @CurrentUser() user: UserDto,
    @Param('assetId', UuidPipe) id: string,
    @Body(new ZodPipe(assetUpdateSchema)) body: z.output<typeof assetUpdateSchema>,
  ): Promise<AssetDto> {
    await this.findOwned(user.id, id);
    if (body.type === 'IMAGE') throw badRequest('VALIDATION_ERROR', '이미지로 바꿀 수 없습니다.');
    const values = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    const [row] = await this.db.update(assets).set({ ...values, updatedAt: new Date() }).where(eq(assets.id, id)).returning();
    await this.activity.log({ actorId: user.id, entityType: 'ASSET', entityId: id, action: 'UPDATE', summary: `산출물 수정: ${row!.title}` });
    return toAssetDto(row!);
  }

  @Delete(':assetId')
  @HttpCode(204)
  async remove(@CurrentUser() user: UserDto, @Param('assetId', UuidPipe) id: string): Promise<void> {
    const current = await this.findOwned(user.id, id);
    await this.db.transaction(async (tx) => {
      await tx.delete(assets).where(eq(assets.id, id));
      await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, current.projectId));
      await this.activity.log({ actorId: user.id, entityType: 'ASSET', entityId: id, action: 'DELETE', summary: `산출물 삭제: ${current.title}` }, tx);
    });
  }

  /** 링크형 산출물만 다룬다 (이미지는 /admin/screenshots) */
  private async findOwned(ownerId: string, id: string) {
    const [row] = await this.db
      .select({ asset: assets })
      .from(assets)
      .innerJoin(projects, eq(projects.id, assets.projectId))
      .where(and(eq(assets.id, id), eq(projects.ownerId, ownerId), ne(assets.type, 'IMAGE')));
    if (!row) throw notFound('산출물');
    return row.asset;
  }
}
