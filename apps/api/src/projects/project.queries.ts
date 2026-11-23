/** 프로젝트 DTO 조립 (대시보드·프로젝트 목록·상세 공용). */
import { asc, count, eq, inArray } from 'drizzle-orm';
import type { AssetDto, ProjectDetailDto, ProjectSummaryDto, RepositoryDto } from '@ppp/shared';
import { toIso } from '../common/pagination.js';
import type { Database } from '../db/database.js';
import { assets, projects, projectSkills, repositories, skills } from '../db/schema.js';

export type ProjectRow = typeof projects.$inferSelect;
export type RepositoryRow = typeof repositories.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;

export async function toProjectSummaries(db: Database, rows: ProjectRow[]): Promise<ProjectSummaryDto[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [repoCounts, skillRows] = await Promise.all([
    db
      .select({ projectId: repositories.projectId, n: count() })
      .from(repositories)
      .where(inArray(repositories.projectId, ids))
      .groupBy(repositories.projectId),
    db
      .select({ projectId: projectSkills.projectId, id: skills.id, name: skills.name })
      .from(projectSkills)
      .innerJoin(skills, eq(skills.id, projectSkills.skillId))
      .where(inArray(projectSkills.projectId, ids))
      .orderBy(asc(skills.displayOrder), asc(skills.name)),
  ]);

  const repoCount = new Map(repoCounts.map((r) => [r.projectId, Number(r.n)]));
  const skillMap = new Map<string, { id: string; name: string }[]>();
  for (const s of skillRows) {
    const list = skillMap.get(s.projectId) ?? [];
    list.push({ id: s.id, name: s.name });
    skillMap.set(s.projectId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    summary: r.summary,
    projectUrl: r.projectUrl,
    status: r.status,
    visibility: r.visibility,
    publicationStatus: r.publicationStatus,
    isFeatured: r.isFeatured,
    startDate: r.startDate,
    endDate: r.endDate,
    sortOrder: r.sortOrder,
    repositoryCount: repoCount.get(r.id) ?? 0,
    skills: skillMap.get(r.id) ?? [],
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
  }));
}

export function toRepositoryDto(r: RepositoryRow): RepositoryDto {
  return {
    id: r.id,
    projectId: r.projectId,
    provider: r.provider,
    name: r.name,
    url: r.url,
    cloneUrl: r.cloneUrl,
    defaultBranch: r.defaultBranch,
    developmentBranch: r.developmentBranch,
    visibility: r.visibility,
    readmeUrl: r.readmeUrl,
    deploymentUrl: r.deploymentUrl,
    isPrimary: r.isPrimary,
    displayOrder: r.displayOrder,
    createdAt: toIso(r.createdAt),
    updatedAt: toIso(r.updatedAt),
  };
}

export function toAssetDto(a: AssetRow): AssetDto {
  return {
    id: a.id,
    projectId: a.projectId,
    type: a.type,
    title: a.title,
    url: a.url,
    visibility: a.visibility,
    displayOrder: a.displayOrder,
    createdAt: toIso(a.createdAt),
  };
}

export async function toProjectDetail(db: Database, row: ProjectRow): Promise<ProjectDetailDto> {
  const [[summary], repoRows, assetRows] = await Promise.all([
    toProjectSummaries(db, [row]),
    db
      .select()
      .from(repositories)
      .where(eq(repositories.projectId, row.id))
      .orderBy(asc(repositories.displayOrder), asc(repositories.createdAt)),
    db.select().from(assets).where(eq(assets.projectId, row.id)).orderBy(asc(assets.displayOrder), asc(assets.createdAt)),
  ]);
  return {
    ...summary!,
    problem: row.problem,
    description: row.description,
    role: row.role,
    outcome: row.outcome,
    repositories: repoRows.map(toRepositoryDto),
    assets: assetRows.map(toAssetDto),
  };
}
