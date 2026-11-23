/**
 * F-007 공개 열람. 로그인 없이 조회하며, 서버가 최종적으로 공개 범위를 통제한다 (API 설계서 §5).
 * - 프로젝트: visibility=PUBLIC 이고 publicationStatus=PUBLISHED 인 것만
 * - 저장소·스크린샷·산출물: 각자 visibility=PUBLIC 인 것만, clone URL·저장소 키 등 관리용 필드는 제외
 * - 프로필: publicationStatus=PUBLISHED 일 때만
 * 단일 소유자 운영: 가장 먼저 만들어진 사용자의 포트폴리오를 공개한다.
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type {
  PublicAssetDto,
  PublicCareerDto,
  PublicProfileDto,
  PublicProjectDetailDto,
  PublicProjectSummaryDto,
  PublicRepositoryDto,
  PublicSkillGroupDto,
  SkillCategory,
} from '@ppp/shared';
import { notFound } from '../common/errors.js';
import { DB } from '../common/tokens.js';
import type { Database } from '../db/database.js';
import { assets, careers, profiles, projects, projectSkills, repositories, skills, users } from '../db/schema.js';

type ProjectRow = typeof projects.$inferSelect;

@Injectable()
export class PublicService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private async ownerId(): Promise<string | null> {
    const [owner] = await this.db.select({ id: users.id }).from(users).orderBy(asc(users.createdAt)).limit(1);
    return owner?.id ?? null;
  }

  private published(ownerId: string) {
    return and(eq(projects.ownerId, ownerId), eq(projects.visibility, 'PUBLIC'), eq(projects.publicationStatus, 'PUBLISHED'));
  }

  async profile(): Promise<PublicProfileDto> {
    const ownerId = await this.ownerId();
    if (!ownerId) throw notFound('프로필');
    const [p] = await this.db
      .select()
      .from(profiles)
      .where(and(eq(profiles.userId, ownerId), eq(profiles.publicationStatus, 'PUBLISHED')));
    if (!p) throw notFound('프로필');
    return {
      displayName: p.displayName,
      headline: p.headline,
      bio: p.bio,
      contactEmail: p.contactEmail,
      location: p.location,
      links: p.links ?? [],
    };
  }

  async projects(keyword?: string): Promise<PublicProjectSummaryDto[]> {
    const ownerId = await this.ownerId();
    if (!ownerId) return [];
    const rows = await this.db
      .select()
      .from(projects)
      .where(this.published(ownerId))
      .orderBy(desc(projects.isFeatured), asc(projects.sortOrder), desc(projects.startDate));
    const list = await this.summaries(rows);
    if (!keyword) return list;
    const k = keyword.trim().replace(/^#/, '').toLowerCase();
    return list.filter((p) => p.skills.some((s) => s.toLowerCase() === k));
  }

  async project(slug: string): Promise<PublicProjectDetailDto> {
    const ownerId = await this.ownerId();
    if (!ownerId || !/^[a-z0-9-]{1,80}$/.test(slug)) throw notFound('프로젝트');
    const [row] = await this.db
      .select()
      .from(projects)
      .where(and(this.published(ownerId), eq(projects.slug, slug)));
    if (!row) throw notFound('프로젝트');

    const [[summary], repoRows, assetRows] = await Promise.all([
      this.summaries([row]),
      this.db
        .select()
        .from(repositories)
        .where(and(eq(repositories.projectId, row.id), eq(repositories.visibility, 'PUBLIC')))
        .orderBy(desc(repositories.isPrimary), asc(repositories.displayOrder)),
      this.db
        .select()
        .from(assets)
        .where(and(eq(assets.projectId, row.id), eq(assets.visibility, 'PUBLIC')))
        .orderBy(asc(assets.displayOrder), asc(assets.createdAt)),
    ]);

    const repos: PublicRepositoryDto[] = repoRows.map((r) => ({
      provider: r.provider,
      name: r.name,
      url: r.url,
      readmeUrl: r.readmeUrl,
      deploymentUrl: r.deploymentUrl,
      isPrimary: r.isPrimary,
    }));
    const publicAssets: PublicAssetDto[] = assetRows.map((a) => ({
      type: a.type,
      title: a.title,
      url: a.url,
      width: a.width,
      height: a.height,
    }));

    return {
      ...summary!,
      problem: row.problem,
      description: row.description,
      role: row.role,
      outcome: row.outcome,
      repositories: repos,
      assets: publicAssets,
    };
  }

  /** 경력 마크다운이 있으면 그것을, 없으면 개별 경력 목록을 공개 화면에 쓴다. */
  async careerMarkdown(): Promise<string | null> {
    const ownerId = await this.ownerId();
    if (!ownerId) return null;
    const [p] = await this.db.select({ md: profiles.careerMarkdown }).from(profiles).where(eq(profiles.userId, ownerId));
    return p?.md?.trim() ? p.md : null;
  }

  async careers(): Promise<PublicCareerDto[]> {
    const ownerId = await this.ownerId();
    if (!ownerId) return [];
    const rows = await this.db
      .select()
      .from(careers)
      .where(and(eq(careers.ownerId, ownerId), eq(careers.visibility, 'PUBLIC')))
      .orderBy(asc(careers.displayOrder), desc(careers.startDate));
    return rows.map((c) => ({
      company: c.company,
      position: c.position,
      startDate: c.startDate,
      endDate: c.endDate,
      description: c.description,
    }));
  }

  /** 게시된 프로젝트에 실제로 쓰인 키워드만, 분류별로 묶어서 */
  async skills(): Promise<PublicSkillGroupDto[]> {
    const ownerId = await this.ownerId();
    if (!ownerId) return [];
    const rows = await this.db
      .select({
        name: skills.name,
        category: skills.category,
        proficiencyLabel: skills.proficiencyLabel,
        order: skills.displayOrder,
        slug: projects.slug,
        title: projects.title,
      })
      .from(skills)
      .innerJoin(projectSkills, eq(projectSkills.skillId, skills.id))
      .innerJoin(projects, eq(projects.id, projectSkills.projectId))
      .where(this.published(ownerId))
      .orderBy(asc(skills.displayOrder), asc(skills.name));

    const groups = new Map<SkillCategory, PublicSkillGroupDto>();
    for (const r of rows) {
      const g = groups.get(r.category) ?? { category: r.category, skills: [] };
      let s = g.skills.find((x) => x.name === r.name);
      if (!s) {
        s = { name: r.name, category: r.category, proficiencyLabel: r.proficiencyLabel, projects: [] };
        g.skills.push(s);
      }
      s.projects.push({ slug: r.slug, title: r.title });
      groups.set(r.category, g);
    }
    return [...groups.values()];
  }

  private async summaries(rows: ProjectRow[]): Promise<PublicProjectSummaryDto[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [skillRows, imageRows] = await Promise.all([
      this.db
        .select({ projectId: projectSkills.projectId, name: skills.name })
        .from(projectSkills)
        .innerJoin(skills, eq(skills.id, projectSkills.skillId))
        .where(inArray(projectSkills.projectId, ids))
        .orderBy(asc(skills.displayOrder), asc(skills.name)),
      this.db
        .select({ projectId: assets.projectId, url: assets.url })
        .from(assets)
        .where(and(inArray(assets.projectId, ids), eq(assets.type, 'IMAGE'), eq(assets.visibility, 'PUBLIC')))
        .orderBy(asc(assets.displayOrder), asc(assets.createdAt)),
    ]);
    const kw = new Map<string, string[]>();
    for (const s of skillRows) kw.set(s.projectId, [...(kw.get(s.projectId) ?? []), s.name]);
    const cover = new Map<string, string>();
    for (const i of imageRows) if (!cover.has(i.projectId)) cover.set(i.projectId, i.url);

    return rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      projectUrl: r.projectUrl,
      coverImageUrl: cover.get(r.id) ?? null,
      status: r.status,
      isFeatured: r.isFeatured,
      startDate: r.startDate,
      endDate: r.endDate,
      skills: kw.get(r.id) ?? [],
    }));
  }
}
