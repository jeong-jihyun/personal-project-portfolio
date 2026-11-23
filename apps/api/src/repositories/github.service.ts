/**
 * GitHub 가져오기: 내 GitHub 계정의 저장소(공개+비공개)를 읽어 저장소 관리에 등록한다.
 * - GITHUB_TOKEN 이 있으면 /user/repos 로 비공개까지, 없으면 GITHUB_USERNAME 의 공개 저장소만 읽는다.
 * - 등록 시 프로젝트를 고르지 않으면 저장소 이름으로 새 프로젝트를 '비공개·비게시'로 만들어 붙인다.
 * - 이미 같은 주소로 등록된 저장소는 건너뛴다(여러 번 눌러도 중복이 생기지 않음).
 */
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  projectCreateSchema,
  repositoryCreateSchema,
  type GithubImportResult,
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
