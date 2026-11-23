import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginAgent, setupApp, type TestContext } from './helpers.js';

describe('public API (F-007) — 서버가 공개 범위를 최종 통제', () => {
  let ctx: TestContext;
  let agent: Awaited<ReturnType<typeof loginAgent>>;

  beforeAll(async () => {
    ctx = await setupApp({ sampleData: true });
    agent = await loginAgent(ctx);
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('is readable without login and lists only public + published projects', async () => {
    const res = await ctx.http.get('/api/v1/public/projects');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('s-maxage=60');
    const slugs = res.body.items.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(expect.arrayContaining(['portfolio-platform', 'knowledge-manager']));
    expect(slugs).not.toContain('workflow-builder'); // 비공개·비게시 예시
    expect(res.body.items[0].slug).toBe('portfolio-platform'); // 대표 프로젝트가 먼저
    expect(res.body.items[0]).not.toHaveProperty('id');
    expect(res.body.items[0]).not.toHaveProperty('visibility');
  });

  it('never exposes private repositories, clone URLs or private screenshots', async () => {
    const res = await ctx.http.get('/api/v1/public/projects/portfolio-platform');
    expect(res.status).toBe(200);
    expect(res.body.repositories.map((r: { name: string }) => r.name)).toEqual(['portfolio-web']);
    const json = JSON.stringify(res.body);
    expect(json).not.toContain('portfolio-api'); // 비공개 저장소
    expect(json).not.toContain('cloneUrl');
    expect(json).not.toContain('storageKey');
    expect(json).not.toContain('ownerId');
    expect(res.body.skills).toEqual(expect.arrayContaining(['React']));
  });

  it('returns 404 for private, unpublished or malformed slugs', async () => {
    expect((await ctx.http.get('/api/v1/public/projects/workflow-builder')).status).toBe(404);
    expect((await ctx.http.get('/api/v1/public/projects/NOT_A_SLUG')).status).toBe(404);
    expect((await ctx.http.get('/api/v1/public/projects/does-not-exist')).status).toBe(404);
  });

  it('reflects publication changes immediately (수용 기준: 게시 상태 변경 후 공개 화면 갱신)', async () => {
    const id = (await agent.get('/api/v1/admin/projects?q=workflow-builder')).body.items[0].id;

    // 게시를 켜면 비공개 프로젝트도 공개로 함께 바뀐다
    const pub = await agent.patch(`/api/v1/admin/projects/${id}/publication`).send({ publicationStatus: 'PUBLISHED', isFeatured: true });
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ publicationStatus: 'PUBLISHED', visibility: 'PUBLIC', isFeatured: true });
    expect((await ctx.http.get('/api/v1/public/projects/workflow-builder')).status).toBe(200);

    // 비공개로 바꾸면 게시 상태와 관계없이 즉시 제외
    await agent.patch(`/api/v1/admin/projects/${id}/publication`).send({ visibility: 'PRIVATE' });
    expect((await ctx.http.get('/api/v1/public/projects/workflow-builder')).status).toBe(404);
    const list = await ctx.http.get('/api/v1/public/projects');
    expect(list.body.items.map((p: { slug: string }) => p.slug)).not.toContain('workflow-builder');

    const acts = await agent.get('/api/v1/admin/activities?limit=2');
    expect(acts.body.items.map((a: { action: string }) => a.action)).toContain('PUBLISH');
  });

  it('filters projects by keyword with or without #', async () => {
    const a = await ctx.http.get('/api/v1/public/projects?keyword=%23react');
    expect(a.body.items.map((p: { slug: string }) => p.slug)).toEqual(['portfolio-platform']);
    const b = await ctx.http.get('/api/v1/public/projects?keyword=Next.js');
    expect(b.body.items.map((p: { slug: string }) => p.slug)).toEqual(['knowledge-manager']);
  });

  it('serves profile, careers and keywords used by published projects only', async () => {
    const profile = await ctx.http.get('/api/v1/public/profile');
    expect(profile.status).toBe(200);
    expect(profile.body).toHaveProperty('displayName');
    expect(profile.body).not.toHaveProperty('publicationStatus');

    const careers = await ctx.http.get('/api/v1/public/careers');
    expect(careers.body.items.length).toBe(1);

    const skills = await ctx.http.get('/api/v1/public/skills');
    const names = skills.body.items.flatMap((g: { skills: { name: string }[] }) => g.skills.map((s) => s.name));
    expect(names).toContain('React');
    expect(names).not.toContain('Node.js'); // 비공개 프로젝트에만 쓰인 키워드
  });

  it('requires login for publication changes', async () => {
    const id = (await agent.get('/api/v1/admin/projects')).body.items[0].id;
    expect((await ctx.http.patch(`/api/v1/admin/projects/${id}/publication`).send({ publicationStatus: 'DRAFT' })).status).toBe(401);
  });
});
