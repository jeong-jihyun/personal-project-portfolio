import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '../src/db/seed.js';
import { loginAgent, setupApp, type TestContext } from './helpers.js';

describe('admin repositories (F-002)', () => {
  let ctx: TestContext;
  let agent: Awaited<ReturnType<typeof loginAgent>>;
  let projectId: string;

  beforeAll(async () => {
    ctx = await setupApp({ sampleData: true });
    agent = await loginAgent(ctx);
    const list = await agent.get('/api/v1/admin/projects?q=workflow-builder');
    projectId = list.body.items[0].id;
  });
  afterAll(async () => {
    await ctx.close();
  });

  const create = (body: Record<string, unknown>) =>
    agent.post(`/api/v1/admin/projects/${projectId}/repositories`).send({ url: 'https://github.com/o/r', ...body });

  it('registers multiple repositories with defaults and validation', async () => {
    const a = await create({ name: 'web', defaultBranch: 'main', visibility: 'PUBLIC' });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ name: 'web', provider: 'GITHUB', isPrimary: false, displayOrder: 1 });
    const b = await create({ name: 'api', url: 'git@github.com:o/api.git' });
    expect(b.status).toBe(201);
    expect(b.body.displayOrder).toBe(2);
    expect(b.body.visibility).toBe('PRIVATE');

    const bad = await create({ name: 'x', url: 'javascript:alert(1)', deploymentUrl: 'ftp://x' });
    expect(bad.status).toBe(400);
    expect(bad.body.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['url', 'deploymentUrl']));

    const list = await agent.get(`/api/v1/admin/projects/${projectId}/repositories`);
    expect(list.body.items).toHaveLength(2);
  });

  it('keeps exactly one primary repository per project', async () => {
    const list = await agent.get(`/api/v1/admin/projects/${projectId}/repositories`);
    const [web, api] = list.body.items;
    expect((await agent.patch(`/api/v1/admin/repositories/${web.id}`).send({ isPrimary: true })).body.isPrimary).toBe(true);
    expect((await agent.patch(`/api/v1/admin/repositories/${api.id}`).send({ isPrimary: true })).body.isPrimary).toBe(true);

    const after = await agent.get(`/api/v1/admin/projects/${projectId}/repositories`);
    const primaries = after.body.items.filter((r: { isPrimary: boolean }) => r.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe(api.id);

    const third = await create({ name: 'docs', isPrimary: true });
    expect(third.body.isPrimary).toBe(true);
    const final = await agent.get(`/api/v1/admin/projects/${projectId}/repositories`);
    expect(final.body.items.filter((r: { isPrimary: boolean }) => r.isPrimary)).toHaveLength(1);
  });

  it('patches only the sent fields and clears optional URLs with empty strings', async () => {
    const r = await create({ name: 'patchable', readmeUrl: 'https://example.com/readme', visibility: 'PUBLIC' });
    const res = await agent.patch(`/api/v1/admin/repositories/${r.body.id}`).send({ readmeUrl: '', developmentBranch: 'develop' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ readmeUrl: null, developmentBranch: 'develop', visibility: 'PUBLIC', name: 'patchable' });
  });

  it('lists all repositories with project titles and filters', async () => {
    const all = await agent.get('/api/v1/admin/repositories');
    expect(all.body.items.length).toBeGreaterThanOrEqual(6);
    expect(all.body.items[0]).toHaveProperty('projectTitle');
    const pub = await agent.get('/api/v1/admin/repositories?visibility=PUBLIC');
    expect(pub.body.items.every((r: { visibility: string }) => r.visibility === 'PUBLIC')).toBe(true);
    const one = await agent.get(`/api/v1/admin/repositories?projectId=${projectId}`);
    expect(one.body.items.every((r: { projectId: string }) => r.projectId === projectId)).toBe(true);
  });

  it('deletes a repository and records activity', async () => {
    const r = await create({ name: 'to-delete' });
    expect((await agent.delete(`/api/v1/admin/repositories/${r.body.id}`)).status).toBe(204);
    expect((await agent.patch(`/api/v1/admin/repositories/${r.body.id}`).send({ name: 'x' })).status).toBe(404);
    const acts = await agent.get('/api/v1/admin/activities?limit=1');
    expect(acts.body.items[0]).toMatchObject({ entityType: 'REPOSITORY', action: 'DELETE' });
  });

  it('isolates repositories between owners', async () => {
    await seed(ctx.database.db, { email: 'other2@example.com', password: 'other-password-2', withSampleData: false });
    const other = await loginAgent(ctx, { email: 'other2@example.com', password: 'other-password-2' });
    const mine = await agent.get(`/api/v1/admin/projects/${projectId}/repositories`);
    const repoId = mine.body.items[0].id;
    expect((await other.get('/api/v1/admin/repositories')).body.items).toHaveLength(0);
    expect((await other.get(`/api/v1/admin/projects/${projectId}/repositories`)).status).toBe(404);
    expect((await other.post(`/api/v1/admin/projects/${projectId}/repositories`).send({ name: 'x', url: 'https://g.com/x' })).status).toBe(404);
    expect((await other.patch(`/api/v1/admin/repositories/${repoId}`).send({ name: 'hack' })).status).toBe(404);
    expect((await other.delete(`/api/v1/admin/repositories/${repoId}`)).status).toBe(404);
  });
});
