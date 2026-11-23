/**
 * GitHub 가져오기: 내 GitHub 계정의 저장소(공개+비공개)를 읽어 저장소 관리에 등록한다.
 * - GITHUB_TOKEN 이 있으면 /user/repos 로 비공개까지, 없으면 GITHUB_USERNAME 의 공개 저장소만 읽는다.
 * - 등록 시 프로젝트를 고르지 않으면 저장소 이름으로 새 프로젝트를 '비공개·비게시'로 만들어 붙인다.
 * - 이미 같은 주소로 등록된 저장소는 건너뛴다(여러 번 눌러도 중복이 생기지 않음).
 *
 * 동기화(sync): 프로젝트 1개 = GitHub 저장소 1개.
 * - GitHub 에 있는데 사이트에 없는 저장소 → 프로젝트를 비공개·비게시로 새로 만든다.
 * - 연결된 프로젝트의 제목(저장소 이름)·요약(설명)·URL(홈페이지)·시작일(만든 날)·마지막 push 시각은 GitHub 값으로 맞춘다.
 * - GitHub 에 없는 프로젝트(직접 만든 것, 지운 저장소)는 건드리지 않는다.
 */
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import {
  projectCreateSchema,
  repositoryCreateSchema,
  type GithubImportResult,
  type GithubSyncResult,
  type GithubReposResponse,
  type githubImportSchema,
} from '@ppp/shared';
import type { z } from 'zod';
import { AppError, badRequest } from '../common/errors.js';
import { DB } from '../common/tokens.js';
import type { Database } from '../db/database.js';
import { projects, repositories } from '../db/schema.js';
import { ProjectsService } from '../projects/projects.service.js';
import { RepositoriesService } from './repositories.service.js';

interface GhRepo {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  private: boolean;
  archived: boolean;
  fork: boolean;
  language: string | null;
  topics?: string[];
  default_branch: string | null;
  homepage: string | null;
  created_at: string | null;
  pushed_at: string | null;
  owner: { login: string };
}

const norm = (url: string) => url.trim().toLowerCase().replace(/\.git$/, '').replace(/\/+$/, '');

@Injectable()
export class GithubService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(RepositoriesService) private readonly repos: RepositoriesService,
  ) {}

  private get token(): string {
    return (process.env.GITHUB_TOKEN ?? '').trim();
  }

  private async gh<T>(path: string): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'personal-project-portfolio',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
    });
    if (res.status === 401) throw badRequest('GITHUB_TOKEN_INVALID', 'GitHub 토큰이 만료되었거나 잘못되었습니다. Vercel 환경변수 GITHUB_TOKEN 을 확인하세요.');
    if (res.status === 403 || res.status === 429) throw new AppError(429, 'GITHUB_RATE_LIMIT', 'GitHub 요청 한도를 넘었습니다. 잠시 후 다시 시도하세요.');
    if (!res.ok) throw new AppError(502, 'GITHUB_ERROR', `GitHub 응답 오류 (${res.status})`);
    return res.json() as Promise<T>;
  }

  /** GitHub 저장소 전체 (100개씩 끝까지) */
  private async fetchAll(): Promise<{ login: string; includesPrivate: boolean; list: GhRepo[] }> {
    let base: string;
    let login: string;
    if (this.token) {
      login = (await this.gh<{ login: string }>('/user')).login;
      base = '/user/repos?affiliation=owner&visibility=all&sort=pushed';
    } else {
      login = (process.env.GITHUB_USERNAME ?? '').trim();
      if (!login) throw badRequest('GITHUB_NOT_CONFIGURED', 'GitHub 연동 설정이 없습니다. Vercel 환경변수에 GITHUB_TOKEN 을 넣어 주세요.');
      base = `/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed`;
    }
    const list: GhRepo[] = [];
    for (let page = 1; page <= 10; page++) {
      const batch = await this.gh<GhRepo[]>(`${base}&per_page=100&page=${page}`);
      list.push(...batch);
      if (batch.length < 100) break;
    }
    return { login, includesPrivate: !!this.token, list };
  }

  /** 이미 등록된 저장소 주소 → 프로젝트 */
  private async registered(ownerId: string): Promise<Map<string, { id: string; title: string }>> {
    const rows = await this.db
      .select({ url: repositories.url, id: projects.id, title: projects.title })
      .from(repositories)
      .innerJoin(projects, eq(projects.id, repositories.projectId))
      .where(eq(projects.ownerId, ownerId));
    return new Map(rows.map((r) => [norm(r.url), { id: r.id, title: r.title }]));
  }

  async list(ownerId: string): Promise<GithubReposResponse> {
    const [{ login, includesPrivate, list }, reg] = await Promise.all([this.fetchAll(), this.registered(ownerId)]);
    return {
      login,
      includesPrivate,
      items: list.map((r) => ({
        fullName: r.full_name,
        name: r.name,
        description: r.description,
        url: r.html_url,
        private: r.private,
        archived: r.archived,
        fork: r.fork,
        language: r.language,
        defaultBranch: r.default_branch,
        pushedAt: r.pushed_at,
        registeredProject: reg.get(norm(r.html_url)) ?? null,
      })),
    };
  }

  async import(ownerId: string, input: z.output<typeof githubImportSchema>): Promise<GithubImportResult> {
    // 저장소 정보는 화면이 보낸 값이 아니라 GitHub 에서 다시 읽은 값을 쓴다.
    const [{ list }, reg] = await Promise.all([this.fetchAll(), this.registered(ownerId)]);
    const byName = new Map(list.map((r) => [r.full_name.toLowerCase(), r]));
    const result: GithubImportResult = { created: 0, skipped: 0, newProjects: 0, errors: [] };

    for (const item of input.items) {
      const r = byName.get(item.fullName.toLowerCase());
      if (!r) {
        result.errors.push({ fullName: item.fullName, message: 'GitHub 에서 찾을 수 없습니다.' });
        continue;
      }
      if (reg.has(norm(r.html_url))) {
        result.skipped++;
        continue;
      }
      try {
        let projectId = item.projectId ?? null;
        let isPrimary = false;
        if (projectId) {
          const existing = await this.repos.listForProject(ownerId, projectId); // 소유권 확인 포함
          isPrimary = !existing.some((x) => x.isPrimary);
        } else {
          const project = await this.projects.create(ownerId, this.projectInput(r));
          projectId = project.id;
          isPrimary = true;
          result.newProjects++;
        }
        const homepage = r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : null;
        await this.repos.create(
          ownerId,
          projectId,
          repositoryCreateSchema.parse({
            provider: 'GITHUB',
            name: r.name,
            url: r.html_url,
            cloneUrl: r.clone_url,
            defaultBranch: r.default_branch,
            visibility: r.private ? 'PRIVATE' : 'PUBLIC',
            readmeUrl: `${r.html_url}#readme`,
            deploymentUrl: homepage,
            isPrimary,
          }),
        );
        reg.set(norm(r.html_url), { id: projectId, title: '' });
        result.created++;
      } catch (e) {
        result.errors.push({ fullName: r.full_name, message: e instanceof Error ? e.message : '등록하지 못했습니다.' });
      }
    }
    return result;
  }

  /** GitHub 전체 동기화 (목록 열 때·하루 1번·버튼) */
  async sync(ownerId: string): Promise<GithubSyncResult> {
    const { list } = await this.fetchAll();
    const now = new Date();
    const result: GithubSyncResult = { total: list.length, created: 0, updated: 0, errors: [], syncedAt: now.toISOString() };

    const projRows = await this.db.select().from(projects).where(eq(projects.ownerId, ownerId));
    const repoRows = await this.db
      .select({ repo: repositories })
      .from(repositories)
      .innerJoin(projects, eq(projects.id, repositories.projectId))
      .where(eq(projects.ownerId, ownerId));
    const byGithub = new Map(projRows.filter((p) => p.githubRepo).map((p) => [p.githubRepo!.toLowerCase(), p]));
    const byId = new Map(projRows.map((p) => [p.id, p]));
    const repoByUrl = new Map(repoRows.map((r) => [norm(r.repo.url), r.repo]));

    for (const r of list) {
      const key = r.full_name.toLowerCase();
      try {
        const homepage = r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : null;
        let project = byGithub.get(key);
        let repoRow = repoByUrl.get(norm(r.html_url));

        if (!project && repoRow) {
          const owner = byId.get(repoRow.projectId);
          // 저장소 주소로 이미 붙어 있던 프로젝트: 아직 다른 저장소와 연결되지 않았으면 그대로 연결
          if (owner && !owner.githubRepo) project = owner;
        }
        const isNew = !project;
        if (!project) {
          const created = await this.projects.create(ownerId, this.projectInput(r));
          [project] = await this.db.select().from(projects).where(eq(projects.id, created.id));
          result.created++;
          if (repoRow) {
            // 1 프로젝트 = 1 저장소: 다른 프로젝트에 붙어 있던 같은 저장소는 새 프로젝트로 옮긴다
            await this.db.update(repositories).set({ projectId: project!.id, isPrimary: true, updatedAt: now }).where(eq(repositories.id, repoRow.id));
            repoRow = { ...repoRow, projectId: project!.id };
          }
        }
        const p = project!;

        // 프로젝트: GitHub 값으로 맞춤 (바뀐 것이 있을 때만 수정 시각 갱신)
        const startDate = r.created_at?.slice(0, 10) ?? null;
        const next = {
          title: r.name.slice(0, 120),
          summary: r.description?.slice(0, 300) ?? null,
          projectUrl: homepage,
          startDate: !p.endDate || !startDate || startDate <= p.endDate ? startDate : p.startDate,
          githubRepo: r.full_name,
          githubPushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
        };
        const changed =
          p.title !== next.title ||
          p.summary !== next.summary ||
          p.projectUrl !== next.projectUrl ||
          p.startDate !== next.startDate ||
          p.githubRepo !== next.githubRepo ||
          (p.githubPushedAt?.getTime() ?? null) !== (next.githubPushedAt?.getTime() ?? null);
        await this.db
          .update(projects)
          .set({ ...next, githubSyncedAt: now, ...(changed ? { updatedAt: now } : {}) })
          .where(and(eq(projects.id, p.id), eq(projects.ownerId, ownerId)));
        if (changed && !isNew) result.updated++;

        // 저장소 행: 없으면 만들고, 있으면 GitHub 값으로 맞춤
        const repoValues = {
          provider: 'GITHUB' as const,
          name: r.name,
          url: r.html_url,
          cloneUrl: r.clone_url,
          defaultBranch: r.default_branch,
          visibility: r.private ? ('PRIVATE' as const) : ('PUBLIC' as const),
          readmeUrl: `${r.html_url}#readme`,
          deploymentUrl: homepage,
        };
        if (repoRow) {
          await this.db.update(repositories).set({ ...repoValues, updatedAt: now }).where(eq(repositories.id, repoRow.id));
        } else {
          await this.db.insert(repositories).values({ ...repoValues, projectId: p.id, isPrimary: true, displayOrder: 1 });
        }
        byGithub.set(key, { ...p, ...next });
      } catch (e) {
        result.errors.push({ fullName: r.full_name, message: e instanceof Error ? e.message : '동기화하지 못했습니다.' });
      }
    }
    return result;
  }

  /** 새 프로젝트: 공개 화면에 나가지 않도록 비공개·비게시(기본값) */
  private projectInput(r: GhRepo) {
    const keywords = [r.language, ...(r.topics ?? [])].filter((k): k is string => !!k).slice(0, 10);
    const homepage = r.homepage && /^https?:\/\//.test(r.homepage) ? r.homepage : null;
    const base = {
      title: r.name.slice(0, 120),
      summary: r.description?.slice(0, 300) ?? null,
      status: r.archived ? 'COMPLETED' : 'IN_PROGRESS',
      visibility: 'PRIVATE',
      startDate: r.created_at?.slice(0, 10) ?? null,
      projectUrl: homepage,
    } as const;
    const parsed = projectCreateSchema.safeParse({ ...base, keywords });
    return parsed.success ? parsed.data : projectCreateSchema.parse(base);
  }
}
