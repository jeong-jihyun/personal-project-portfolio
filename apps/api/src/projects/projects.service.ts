/** F-001 프로젝트 관리. 모든 조회·변경은 ownerId로 범위를 제한하고, 남의 리소스는 404로 숨긴다. */
import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, max, ne, or, sql, type SQL } from 'drizzle-orm';
import {
  PROJECT_STATUSES,
  slugify,
  type ListQuery,
  type Paginated,
  type ProjectDeleteImpactDto,
  type ProjectDetailDto,
  type ProjectStatus,
  type ProjectSummaryDto,
  type projectCreateSchema,
  type projectUpdateSchema,
} from '@ppp/shared';
import type { z } from 'zod';
import { ActivityService } from '../activity/activity.service.js';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { likePattern, paginate } from '../common/pagination.js';
import { DB } from '../common/tokens.js';
import type { Database } from '../db/database.js';
import { assets, projects, projectSkills, repositories, skills } from '../db/schema.js';
import type { FileStorage } from '../storage/file-storage.js';
import { FILE_STORAGE } from '../storage/storage.module.js';
import { toProjectDetail, toProjectSummaries, type ProjectRow } from './project.queries.js';

type CreateInput = z.output<typeof projectCreateSchema>;
type UpdateInput = z.output<typeof projectUpdateSchema>;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const SORTABLE = {
  updatedAt: projects.updatedAt,
  createdAt: projects.createdAt,
  title: projects.title,
  startDate: projects.startDate,
  sortOrder: projects.sortOrder,
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ActivityService) private readonly activity: ActivityService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async list(ownerId: string, q: ListQuery): Promise<Paginated<ProjectSummaryDto>> {
    const conds: SQL[] = [eq(projects.ownerId, ownerId)];
    if (q.q) {
      const p = likePattern(q.q);
      conds.push(or(ilike(projects.title, p), ilike(projects.summary, p), ilike(projects.slug, p))!);
    }
    if (q.status) {
      if (!(PROJECT_STATUSES as readonly string[]).includes(q.status)) {
        throw badRequest('VALIDATION_ERROR', '알 수 없는 상태 값입니다.', [{ path: 'status', message: q.status }]);
      }
      conds.push(eq(projects.status, q.status as ProjectStatus));
    }
    if (q.visibility) conds.push(eq(projects.visibility, q.visibility));
    const where = and(...conds);

    const sortCol = SORTABLE[(q.sort ?? 'updatedAt') as keyof typeof SORTABLE] ?? projects.updatedAt;
    const order = q.order === 'asc' ? asc(sortCol) : desc(sortCol);

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(projects)
        .where(where)
        .orderBy(order, desc(projects.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      this.db.select({ n: count() }).from(projects).where(where),
    ]);
    return paginate(await toProjectSummaries(this.db, rows), Number(total?.n ?? 0), q.page, q.pageSize);
  }

  async get(ownerId: string, id: string): Promise<ProjectDetailDto> {
    return toProjectDetail(this.db, await this.findOwned(ownerId, id));
  }

  async create(ownerId: string, input: CreateInput): Promise<ProjectDetailDto> {
    const { skillIds, keywords, slug: requestedSlug, ...fields } = input;
    if (!keywords) await this.assertOwnedSkills(ownerId, skillIds);
    const slug = requestedSlug ? await this.assertSlugFree(requestedSlug) : await this.generateSlug(fields.title);

    const row = await this.db.transaction(async (tx) => {
      const [last] = await tx
        .select({ maxOrder: max(projects.sortOrder) })
        .from(projects)
        .where(eq(projects.ownerId, ownerId));
      const [created] = await tx
        .insert(projects)
        .values({ ...fields, ownerId, slug, sortOrder: Number(last?.maxOrder ?? 0) + 1 })
        .returning();
      const linkIds = keywords ? await this.resolveKeywords(tx, ownerId, keywords) : skillIds;
      if (linkIds?.length) {
        await tx.insert(projectSkills).values(linkIds.map((skillId) => ({ projectId: created!.id, skillId })));
      }
      await this.activity.log(
        { actorId: ownerId, entityType: 'PROJECT', entityId: created!.id, action: 'CREATE', summary: `프로젝트 등록: ${created!.title}` },
        tx,
      );
      return created!;
    });
    return toProjectDetail(this.db, row);
  }

  async update(ownerId: string, id: string, input: UpdateInput): Promise<ProjectDetailDto> {
    const current = await this.findOwned(ownerId, id);
    const { skillIds, keywords, slug, ...fields } = input;

    // 기간 검증은 기존 값과 합친 결과로 한다 (한쪽만 바꾸는 PATCH 대비).
    const startDate = fields.startDate !== undefined ? fields.startDate : current.startDate;
    const endDate = fields.endDate !== undefined ? fields.endDate : current.endDate;
    if (startDate && endDate && endDate < startDate) {
      throw badRequest('VALIDATION_ERROR', '입력값을 확인하세요.', [
        { path: 'endDate', message: '종료일은 시작일보다 빠를 수 없습니다.' },
      ]);
    }
    if (!keywords) await this.assertOwnedSkills(ownerId, skillIds);
    const nextSlug = slug && slug !== current.slug ? await this.assertSlugFree(slug, id) : undefined;

    const values = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const row = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(projects)
        .set({ ...values, ...(nextSlug ? { slug: nextSlug } : {}), updatedAt: new Date() })
        .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
        .returning();
      const linkIds = keywords ? await this.resolveKeywords(tx, ownerId, keywords) : skillIds;
      if (linkIds) {
        await tx.delete(projectSkills).where(eq(projectSkills.projectId, id));
        if (linkIds.length) await tx.insert(projectSkills).values(linkIds.map((skillId) => ({ projectId: id, skillId })));
      }
      await this.activity.log(
        { actorId: ownerId, entityType: 'PROJECT', entityId: id, action: 'UPDATE', summary: `프로젝트 수정: ${updated!.title}` },
        tx,
      );
      return updated!;
    });
    return toProjectDetail(this.db, row);
  }

  async deleteImpact(ownerId: string, id: string): Promise<ProjectDeleteImpactDto> {
    await this.findOwned(ownerId, id);
    const [[r], [a], [s]] = await Promise.all([
      this.db.select({ n: count() }).from(repositories).where(eq(repositories.projectId, id)),
      this.db.select({ n: count() }).from(assets).where(eq(assets.projectId, id)),
      this.db.select({ n: count() }).from(projectSkills).where(eq(projectSkills.projectId, id)),
    ]);
    return { repositories: Number(r?.n ?? 0), assets: Number(a?.n ?? 0), skills: Number(s?.n ?? 0) };
  }

  /** 삭제 정책: hard delete. 저장소·산출물·기술 연결은 함께 삭제되고, 기술 항목 자체는 남는다. */
  async remove(ownerId: string, id: string): Promise<void> {
    const current = await this.findOwned(ownerId, id);
    const files = await this.db.select({ key: assets.storageKey }).from(assets).where(eq(assets.projectId, id));
    await this.db.transaction(async (tx) => {
      await tx.delete(projects).where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
      await this.activity.log(
        { actorId: ownerId, entityType: 'PROJECT', entityId: id, action: 'DELETE', summary: `프로젝트 삭제: ${current.title}` },
        tx,
      );
    });
    // 업로드한 스크린샷 파일 정리 (실패해도 삭제 자체는 완료)
    for (const f of files) if (f.key) await this.storage.delete(f.key).catch(() => undefined);
  }

  async findOwned(ownerId: string, id: string): Promise<ProjectRow> {
    const [row] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)));
    if (!row) throw notFound('프로젝트');
    return row;
  }

  /**
   * 직접 입력한 키워드를 키워드(skills) 항목 ID로 바꾼다.
   * 대소문자를 무시하고 기존 항목을 재사용하며, 없으면 새로 만든다. 입력 순서를 유지한다.
   */
  private async resolveKeywords(tx: Tx, ownerId: string, keywords: string[]): Promise<string[]> {
    if (keywords.length === 0) return [];
    const lowered = keywords.map((k) => k.toLowerCase());
    const findExisting = () =>
      tx
        .select({ id: skills.id, name: skills.name })
        .from(skills)
        .where(and(eq(skills.ownerId, ownerId), inArray(sql<string>`lower(${skills.name})`, lowered)));

    const existing = await findExisting();
    const have = new Set(existing.map((e) => e.name.toLowerCase()));
    const missing = keywords.filter((k) => !have.has(k.toLowerCase()));
    if (missing.length) {
      const [last] = await tx.select({ n: max(skills.displayOrder) }).from(skills).where(eq(skills.ownerId, ownerId));
      const base = Number(last?.n ?? 0);
      await tx
        .insert(skills)
        .values(missing.map((name, i) => ({ ownerId, name, category: 'OTHER' as const, displayOrder: base + i + 1 })))
        .onConflictDoNothing();
    }
    const all = missing.length ? await findExisting() : existing;
    const byLower = new Map(all.map((e) => [e.name.toLowerCase(), e.id]));
    return lowered.map((k) => byLower.get(k)).filter((v): v is string => !!v);
  }

  private async assertOwnedSkills(ownerId: string, skillIds: string[] | undefined): Promise<void> {
    if (!skillIds?.length) return;
    const unique = [...new Set(skillIds)];
    const found = await this.db
      .select({ id: skills.id })
      .from(skills)
      .where(and(eq(skills.ownerId, ownerId), inArray(skills.id, unique)));
    if (found.length !== unique.length) {
      throw badRequest('VALIDATION_ERROR', '입력값을 확인하세요.', [{ path: 'skillIds', message: '존재하지 않는 기술이 포함되어 있습니다.' }]);
    }
  }

  private async assertSlugFree(slug: string, exceptId?: string): Promise<string> {
    const where = exceptId ? and(eq(projects.slug, slug), ne(projects.id, exceptId)) : eq(projects.slug, slug);
    const [taken] = await this.db.select({ id: projects.id }).from(projects).where(where);
    if (taken) {
      throw conflict('SLUG_TAKEN', '이미 사용 중인 slug입니다.', [{ path: 'slug', message: '이미 사용 중인 slug입니다. 다른 값을 입력하세요.' }]);
    }
    return slug;
  }

  /** 제목에서 slug를 만들고, 비거나(한글 제목) 겹치면 짧은 무작위 접미사를 붙인다. */
  private async generateSlug(title: string): Promise<string> {
    const base = slugify(title) || 'project';
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 && base !== 'project' ? base : `${base}-${randomBytes(3).toString('hex')}`;
      const [taken] = await this.db.select({ id: projects.id }).from(projects).where(eq(projects.slug, candidate));
      if (!taken) return candidate;
    }
    return `${base}-${randomBytes(6).toString('hex')}`;
  }
}
