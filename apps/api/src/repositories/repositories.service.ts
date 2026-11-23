/**
 * F-002 저장소 관리. 소유권은 저장소 → 프로젝트 → ownerId 로 확인한다.
 * 대표 저장소 규칙: 프로젝트당 최대 1개. 새로 대표로 지정하면 같은 프로젝트의 기존 대표를 해제한다(DB 부분 고유 인덱스로 이중 보장).
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, max, ne, type SQL } from 'drizzle-orm';
import {
  type RepositoryDto,
  type RepositoryWithProjectDto,
  type repositoryCreateSchema,
  type repositoryUpdateSchema,
  type Visibility,
} from '@ppp/shared';
import type { z } from 'zod';
import { ActivityService } from '../activity/activity.service.js';
import { notFound } from '../common/errors.js';
import { DB } from '../common/tokens.js';
import type { Database } from '../db/database.js';
import { projects, repositories } from '../db/schema.js';
import { toRepositoryDto } from '../projects/project.queries.js';
import { ProjectsService } from '../projects/projects.service.js';

type CreateInput = z.output<typeof repositoryCreateSchema>;
type UpdateInput = z.output<typeof repositoryUpdateSchema>;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class RepositoriesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  /** ADM-05: 내 모든 저장소 (프로젝트명 포함) */
  async listAll(ownerId: string, filter: { projectId?: string; visibility?: Visibility }): Promise<RepositoryWithProjectDto[]> {
    const conds: SQL[] = [eq(projects.ownerId, ownerId)];
    if (filter.projectId) conds.push(eq(repositories.projectId, filter.projectId));
    if (filter.visibility) conds.push(eq(repositories.visibility, filter.visibility));
    const rows = await this.db
      .select({ repo: repositories, projectTitle: projects.title })
      .from(repositories)
      .innerJoin(projects, eq(projects.id, repositories.projectId))
      .where(and(...conds))
      .orderBy(asc(projects.title), asc(repositories.displayOrder), asc(repositories.createdAt));
    return rows.map((r) => ({ ...toRepositoryDto(r.repo), projectTitle: r.projectTitle }));
  }

  async listForProject(ownerId: string, projectId: string): Promise<RepositoryDto[]> {
    await this.projects.findOwned(ownerId, projectId);
    const rows = await this.db
      .select()
      .from(repositories)
      .where(eq(repositories.projectId, projectId))
      .orderBy(asc(repositories.displayOrder), asc(repositories.createdAt));
    return rows.map(toRepositoryDto);
  }

  async create(ownerId: string, projectId: string, input: CreateInput): Promise<RepositoryDto> {
    const project = await this.projects.findOwned(ownerId, projectId);
    const row = await this.db.transaction(async (tx) => {
      if (input.isPrimary) await this.clearPrimary(tx, projectId);
      const [last] = await tx
        .select({ n: max(repositories.displayOrder) })
        .from(repositories)
        .where(eq(repositories.projectId, projectId));
      const [created] = await tx
        .insert(repositories)
        .values({ ...input, projectId, displayOrder: input.displayOrder || Number(last?.n ?? 0) + 1 })
        .returning();
      await this.touchProject(tx, projectId);
      await this.activity.log(
        {
          actorId: ownerId,
          entityType: 'REPOSITORY',
          entityId: created!.id,
          action: 'CREATE',
          summary: `저장소 등록: ${created!.name} (${project.title})`,
        },
        tx,
      );
      return created!;
    });
    return toRepositoryDto(row);
  }

  async update(ownerId: string, id: string, input: UpdateInput): Promise<RepositoryDto> {
    const current = await this.findOwned(ownerId, id);
    const values = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    const row = await this.db.transaction(async (tx) => {
      if (input.isPrimary) await this.clearPrimary(tx, current.projectId, id);
      const [updated] = await tx
        .update(repositories)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(repositories.id, id))
        .returning();
      await this.touchProject(tx, current.projectId);
      await this.activity.log(
        { actorId: ownerId, entityType: 'REPOSITORY', entityId: id, action: 'UPDATE', summary: `저장소 수정: ${updated!.name}` },
        tx,
      );
      return updated!;
    });
    return toRepositoryDto(row);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    const current = await this.findOwned(ownerId, id);
    await this.db.transaction(async (tx) => {
      await tx.delete(repositories).where(eq(repositories.id, id));
      await this.touchProject(tx, current.projectId);
      await this.activity.log(
        { actorId: ownerId, entityType: 'REPOSITORY', entityId: id, action: 'DELETE', summary: `저장소 삭제: ${current.name}` },
        tx,
      );
    });
  }

  private async findOwned(ownerId: string, id: string) {
    const [row] = await this.db
      .select({ repo: repositories })
      .from(repositories)
      .innerJoin(projects, eq(projects.id, repositories.projectId))
      .where(and(eq(repositories.id, id), eq(projects.ownerId, ownerId)));
    if (!row) throw notFound('저장소');
    return row.repo;
  }

  private async clearPrimary(tx: Tx, projectId: string, exceptId?: string): Promise<void> {
    const conds: SQL[] = [eq(repositories.projectId, projectId), eq(repositories.isPrimary, true)];
    if (exceptId) conds.push(ne(repositories.id, exceptId));
    await tx.update(repositories).set({ isPrimary: false, updatedAt: new Date() }).where(and(...conds));
  }

  private async touchProject(tx: Tx, projectId: string): Promise<void> {
    await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
  }
}
