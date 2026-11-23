import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '../src/db/seed.js';
import { repositories } from '../src/db/schema.js';
import { loginAgent, setupApp, type TestContext } from './helpers.js';

describe('admin projects (F-001)', () => {
  let ctx: TestContext;
  let agent: Awaited<ReturnType<typeof loginAgent>>;
  beforeAll(async () => {
    ctx = await setupApp({ sampleData: true });
    agent = await loginAgent(ctx);
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('requires login', async () => {
    expect((await ctx.http.get('/api/v1/admin/projects')).status).toBe(401);
    expect((await ctx.http.get('/api/v1/admin/dashboard')).status).toBe(401);
  });

  it('lists projects with pagination, search and filters', async () => {
    const all = await agent.get('/api/v1/admin/projects');
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
    expect(all.body.items[0]).toHaveProperty('repositoryCount');

    const paged = await agent.get('/api/v1/admin/projects?pageSize=2&page=2&sort=title&order=asc');
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.total).toBe(3);

    const searched = await agent.get(`/api/v1/admin/projects?q=${encodeURIComponent('지식')}`);
    expect(searched.body.items.map((p: { slug: string }) => p.slug)).toEqual(['knowledge-manager']);

    const byStatus = await agent.get('/api/v1/admin/projects?status=COMPLETED');
    expect(byStatus.body.total).toBe(1);
    const byVis = await agent.get('/api/v1/admin/projects?visibility=PRIVATE');
    expect(byVis.body.total).toBe(1);

    expect((await agent.get('/api/v1/admin/projects?status=WRONG')).status).toBe(400);
    expect((await agent.get('/api/v1/admin/projects?pageSize=1000')).status).toBe(400);
  });

  it('escapes LIKE wildcards in search', async () => {
    const res = await agent.get('/api/v1/admin/projects?q=%25');
    expect(res.body.total).toBe(0);
  });

  it('creates a project, generating a slug and linking skills', async () => {
    const skills = await agent.get('/api/v1/admin/skills');
    const react = skills.body.items.find((s: { name: string }) => s.name === 'React');
    const res = await agent.post('/api/v1/admin/projects').send({
      title: 'New Portfolio Site',
      summary: '요약',
      status: 'IN_PROGRESS',
      startDate: '2026-01-01',
      skillIds: [react.id],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ slug: 'new-portfolio-site', status: 'IN_PROGRESS', visibility: 'PRIVATE', publicationStatus: 'DRAFT' });
    expect(res.body.skills).toEqual([{ id: react.id, name: 'React' }]);

    // 목록과 상세에 같은 데이터 (수용 기준)
    const detail = await agent.get(`/api/v1/admin/projects/${res.body.id}`);
    expect(detail.body.title).toBe('New Portfolio Site');
    expect(detail.body.summary).toBe('요약');
  });

  it('generates a fallback slug for Korean titles and rejects duplicate slugs', async () => {
    const ko = await agent.post('/api/v1/admin/projects').send({ title: '한글 제목 프로젝트' });
    expect(ko.status).toBe(201);
    expect(ko.body.slug).toMatch(/^project-[0-9a-f]{6}$/);

    const dup = await agent.post('/api/v1/admin/projects').send({ title: 'x', slug: 'portfolio-platform' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('SLUG_TAKEN');
    expect(dup.body.details[0].path).toBe('slug');
  });

  it('validates period on create and on partial update', async () => {
    const bad = await agent.post('/api/v1/admin/projects').send({ title: 'p', startDate: '2026-05-02', endDate: '2026-05-01' });
    expect(bad.status).toBe(400);
    expect(bad.body.details[0].path).toBe('endDate');

    const created = await agent.post('/api/v1/admin/projects').send({ title: 'period', startDate: '2026-05-10' });
    const patch = await agent.patch(`/api/v1/admin/projects/${created.body.id}`).send({ endDate: '2026-05-01' });
    expect(patch.status).toBe(400);
    expect(patch.body.details[0].path).toBe('endDate');
  });

  it('updates only the fields sent and replaces skills when given', async () => {
    const created = await agent.post('/api/v1/admin/projects').send({ title: 'patch me', summary: 'keep', role: 'dev' });
    const res = await agent.patch(`/api/v1/admin/projects/${created.body.id}`).send({ role: '', status: 'ON_HOLD', skillIds: [] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ summary: 'keep', role: null, status: 'ON_HOLD', skills: [] });
  });

  it('rejects skills that belong to someone else', async () => {
    const res = await agent
      .post('/api/v1/admin/projects')
      .send({ title: 'x', skillIds: ['00000000-0000-4000-8000-000000000000'] });
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe('skillIds');
  });

  it('reports delete impact and deletes with cascade, logging activity', async () => {
    const list = await agent.get('/api/v1/admin/projects?q=portfolio-platform');
    const id = list.body.items[0].id;
    const impact = await agent.get(`/api/v1/admin/projects/${id}/delete-impact`);
    expect(impact.body).toEqual({ repositories: 2, assets: 0, skills: 3 });

    expect((await agent.delete(`/api/v1/admin/projects/${id}`)).status).toBe(204);
    expect((await agent.get(`/api/v1/admin/projects/${id}`)).status).toBe(404);
    expect(await ctx.database.db.select().from(repositories)).toHaveLength(0);

    const acts = await agent.get('/api/v1/admin/activities?limit=1');
    expect(acts.body.items[0]).toMatchObject({ entityType: 'PROJECT', action: 'DELETE' });
  });

  it('isolates projects between owners (404 for others)', async () => {
    await seed(ctx.database.db, { email: 'other@example.com', password: 'other-password-1', withSampleData: false });
    const other = await loginAgent(ctx, { email: 'other@example.com', password: 'other-password-1' });
    const mine = await agent.get('/api/v1/admin/projects');
    const id = mine.body.items[0].id;

    expect((await other.get('/api/v1/admin/projects')).body.total).toBe(0);
    expect((await other.get(`/api/v1/admin/projects/${id}`)).status).toBe(404);
    expect((await other.patch(`/api/v1/admin/projects/${id}`).send({ title: 'hack' })).status).toBe(404);
    expect((await other.delete(`/api/v1/admin/projects/${id}`)).status).toBe(404);
    expect((await other.get('/api/v1/admin/projects/not-a-uuid')).status).toBe(404);
  });

  it('summarizes the dashboard from real data', async () => {
    const res = await agent.get('/api/v1/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.totalProjects).toBe(
      Object.values(res.body.byStatus as Record<string, number>).reduce((a, b) => a + b, 0),
    );
    expect(res.body.recentProjects.length).toBeGreaterThan(0);
    expect(res.body.recentActivities.length).toBeGreaterThan(0);
  });
});
