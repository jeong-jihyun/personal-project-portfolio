/** 프로젝트 스크린샷: 이미지 업로드(assets.type = IMAGE). 첫 번째(표시 순서) 이미지가 대표 이미지다. */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, asc, count, eq, inArray, max } from 'drizzle-orm';
import {
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MAX_PER_PROJECT,
  type AssetDto,
  type Visibility,
} from '@ppp/shared';
import { ActivityService } from '../activity/activity.service.js';
import { AppError, badRequest, notFound } from '../common/errors.js';
import { DB } from '../common/tokens.js';
import type { Database } from '../db/database.js';
import { assets, projects } from '../db/schema.js';
import { toAssetDto } from '../projects/project.queries.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { FileStorage } from '../storage/file-storage.js';
import { sniffImage } from '../storage/image-sniff.js';
import { FILE_STORAGE } from '../storage/storage.module.js';

@Injectable()
export class ScreenshotsService {
  private readonly logger = new Logger('Screenshots');

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  async upload(
    ownerId: string,
    projectId: string,
    file: { buffer: Buffer; size: number; originalname?: string } | undefined,
    title: string | undefined,
  ): Promise<AssetDto> {
    const project = await this.projects.findOwned(ownerId, projectId);
    if (!file?.buffer?.length) throw badRequest('VALIDATION_ERROR', '이미지 파일을 선택하세요.', [{ path: 'file', message: '파일이 없습니다.' }]);
    if (file.size > SCREENSHOT_MAX_BYTES) throw new AppError(413, 'PAYLOAD_TOO_LARGE', '이미지는 4MB 이하만 올릴 수 있습니다.');

    const image = sniffImage(file.buffer);
    if (!image) {
      throw badRequest('UNSUPPORTED_IMAGE', 'PNG, JPG, WebP, GIF 이미지만 올릴 수 있습니다.', [
        { path: 'file', message: '지원하지 않는 파일 형식입니다.' },
      ]);
    }

    const [{ n } = { n: 0 }] = await this.db
      .select({ n: count() })
      .from(assets)
      .where(and(eq(assets.projectId, projectId), eq(assets.type, 'IMAGE')));
    if (Number(n) >= SCREENSHOT_MAX_PER_PROJECT) {
      throw badRequest('TOO_MANY_SCREENSHOTS', `스크린샷은 프로젝트당 ${SCREENSHOT_MAX_PER_PROJECT}장까지 올릴 수 있습니다.`);
    }

    let stored;
    try {
      stored = await this.storage.put(`projects`, image.ext, file.buffer, image.contentType);
    } catch (e) {
      if ((e as Error).message === 'STORAGE_NOT_CONFIGURED') {
        throw new AppError(503, 'STORAGE_NOT_CONFIGURED', '이미지 저장소가 아직 연결되지 않았습니다. 관리자에게 문의하세요.');
      }
      throw e;
    }

    const cleanTitle = (title ?? '').trim().slice(0, 120) || this.defaultTitle(file.originalname);
    try {
      const row = await this.db.transaction(async (tx) => {
        const [last] = await tx
          .select({ m: max(assets.displayOrder) })
          .from(assets)
          .where(and(eq(assets.projectId, projectId), eq(assets.type, 'IMAGE')));
        const [created] = await tx
          .insert(assets)
          .values({
            projectId,
            type: 'IMAGE',
            title: cleanTitle,
            url: stored.url,
            storageKey: stored.key,
            width: image.width,
            height: image.height,
            visibility: 'PUBLIC',
            displayOrder: Number(last?.m ?? 0) + 1,
          })
          .returning();
        await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
        await this.activity.log(
          { actorId: ownerId, entityType: 'ASSET', entityId: created!.id, action: 'CREATE', summary: `스크린샷 등록: ${project.title}` },
          tx,
        );
        return created!;
      });
      return toAssetDto(row);
    } catch (e) {
      // DB 저장에 실패하면 올린 파일을 지워 고아 파일을 남기지 않는다.
      await this.storage.delete(stored.key).catch(() => undefined);
      throw e;
    }
  }

  async update(ownerId: string, assetId: string, input: { title?: string; visibility?: Visibility }): Promise<AssetDto> {
    const current = await this.findOwned(ownerId, assetId);
    const values: Partial<typeof assets.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) values.title = input.title || current.title;
    if (input.visibility !== undefined) values.visibility = input.visibility;
    const [row] = await this.db.update(assets).set(values).where(eq(assets.id, assetId)).returning();
    await this.activity.log({ actorId: ownerId, entityType: 'ASSET', entityId: assetId, action: 'UPDATE', summary: `스크린샷 수정: ${row!.title}` });
    return toAssetDto(row!);
  }

  /** 순서 변경. 목록 맨 앞이 대표 이미지가 된다. 전달하지 않은 이미지는 뒤에 기존 순서대로 붙는다. */
  async reorder(ownerId: string, projectId: string, assetIds: string[]): Promise<AssetDto[]> {
    await this.projects.findOwned(ownerId, projectId);
    const rows = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.projectId, projectId), eq(assets.type, 'IMAGE')))
      .orderBy(asc(assets.displayOrder), asc(assets.createdAt));
    const known = new Set(rows.map((r) => r.id));
    if (assetIds.some((id) => !known.has(id))) throw notFound('스크린샷');
    const ordered = [...new Set(assetIds), ...rows.map((r) => r.id).filter((id) => !assetIds.includes(id))];

    await this.db.transaction(async (tx) => {
      for (const [i, id] of ordered.entries()) {
        await tx.update(assets).set({ displayOrder: i + 1 }).where(eq(assets.id, id));
      }
      await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
      await this.activity.log(
        { actorId: ownerId, entityType: 'ASSET', entityId: ordered[0] ?? null, action: 'REORDER', summary: '스크린샷 순서 변경' },
        tx,
      );
    });
    const after = await this.db.select().from(assets).where(inArray(assets.id, ordered)).orderBy(asc(assets.displayOrder));
    return after.map(toAssetDto);
  }

  async remove(ownerId: string, assetId: string): Promise<void> {
    const current = await this.findOwned(ownerId, assetId);
    await this.db.transaction(async (tx) => {
      await tx.delete(assets).where(eq(assets.id, assetId));
      await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, current.projectId));
      await this.activity.log(
        { actorId: ownerId, entityType: 'ASSET', entityId: assetId, action: 'DELETE', summary: `스크린샷 삭제: ${current.title}` },
        tx,
      );
    });
    if (current.storageKey) {
      await this.storage.delete(current.storageKey).catch((e) => this.logger.warn(`파일 삭제 실패(${current.storageKey}): ${e}`));
    }
  }

  private async findOwned(ownerId: string, assetId: string) {
    const [row] = await this.db
      .select({ asset: assets })
      .from(assets)
      .innerJoin(projects, eq(projects.id, assets.projectId))
      .where(and(eq(assets.id, assetId), eq(projects.ownerId, ownerId), eq(assets.type, 'IMAGE')));
    if (!row) throw notFound('스크린샷');
    return row.asset;
  }

  private defaultTitle(name?: string): string {
    const base = (name ?? '').replace(/\.[^.]+$/, '').trim();
    return (base || '스크린샷').slice(0, 120);
  }
}
