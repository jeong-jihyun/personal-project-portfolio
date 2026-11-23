import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '../src/db/seed.js';
import { loginAgent, setupApp, type TestContext } from './helpers.js';

describe('step 8: profile, careers, keywords, asset links', () => {
  let ctx: TestContext;
  let agent: Awaited<ReturnType<typeof loginAgent>>;
  beforeAll(async () => {
    ctx = await setupApp({ sampleData: true });
    agent = await loginAgent(ctx);
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('edits the profile and reflects it on the public site', async () => {
    const res = await agent.put('/api/v1/admin/profile').send({
      displayName: '홍길동',
      headline: '백엔드 개발자',
      bio: '소개글',
      contactEmail: 'me@example.com',
      links: [{ label: 'GitHub', url: 'https://github.com/me' }],
      publicationStatus: 'PUBLISHED',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ displayName: '홍길동', links: [{ label: 'GitHub' }] });
    expect((await agent.get('/api/v1/auth/session')).body.user.displayName).toBe('홍길동');
    expect((await ctx.http.get('/api/v1/public/profile')).body.headline).toBe('백엔드 개발자');

    const bad = await agent.put('/api/v1/admin/profile').send({ displayName: '', contactEmail: 'x', links: [{ label: 'a', url: 'javascript:1' }] });
    expect(bad.status).toBe(400);
    const paths = bad.body.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['displayName', 'contactEmail', 'links.0.url']));

    await agent.put('/api/v1/admin/profile').send({ displayName: '홍길동', publicationStatus: 'DRAFT' });
    expect((await ctx.http.get('/api/v1/public/profile')).status).toBe(404);
  });

  it('manages careers with period validation and public visibility', async () => {
    const created = await agent.post('/api/v1/admin/careers').send({ company: 'A사', position: '개발', startDate: '2021-03-01', visibility: 'PRIVATE' });
    expect(created.status).toBe(201);
    expect((await ctx.http.get('/api/v1/public/careers')).body.items.map((c: { company: string }) => c.company)).not.toContain('A사');

    const bad = await agent.patch(`/api/v1/admin/careers/${created.body.id}`).send({ endDate: '2020-01-01' });
    expect(bad.status).toBe(400);
    const ok = await agent.patch(`/api/v1/admin/careers/${created.body.id}`).send({ endDate: '2023-12-31', visibility: 'PUBLIC' });
    expect(ok.body).toMatchObject({ endDate: '2023-12-31', visibility: 'PUBLIC', company: 'A사' });
    expect((await ctx.http.get('/api/v1/public/careers')).body.items.map((c: { company: string }) => c.company)).toContain('A사');

    expect((await agent.delete(`/api/v1/admin/careers/${created.body.id}`)).status).toBe(204);
    expect((await agent.get('/api/v1/admin/careers')).body.items.map((c: { id: string }) => c.id)).not.toContain(created.body.id);
  });

  it('saves career markdown and shows it on the public careers endpoint', async () => {
    const md = '### 프로젝트 A\n\n**2025**\n\n- **근무기간**: 25.01~25.06\n  - 업무 1\n';
    const res = await agent.put('/api/v1/admin/profile/career').send({ markdown: md });
    expect(res.status).toBe(200);
    expect((await agent.get('/api/v1/admin/profile')).body.careerMarkdown).toBe(md);
    expect((await ctx.http.get('/api/v1/public/careers')).body.markdown).toBe(md);

    // 프로필 저장이 경력 마크다운을 지우지 않는다
    await agent.put('/api/v1/admin/profile').send({ displayName: '홍길동', publicationStatus: 'PUBLISHED' });
    expect((await agent.get('/api/v1/admin/profile')).body.careerMarkdown).toBe(md);

    expect((await agent.put('/api/v1/admin/profile/career').send({ markdown: 'x'.repeat(50001) })).status).toBe(400);
    await agent.put('/api/v1/admin/profile/career').send({ markdown: '  ' });
    expect((await ctx.http.get('/api/v1/public/careers')).body.markdown).toBeNull();
    expect((await ctx.http.put('/api/v1/admin/profile/career').send({ markdown: 'x' })).status).toBe(401);
  });

  it('renames, merges and deletes keywords', async () => {
    const list = async () => (await agent.get('/api/v1/admin/skills')).body.items as { id: string; name: string; projectCount: number }[];
    const ts = (await list()).find((s) => s.name === 'TypeScript')!;
    const renamed = await agent.patch(`/api/v1/admin/skills/${ts.id}`).send({ name: '#TS' });
    expect(renamed.body).toEqual({ merged: false, id: ts.id });
    expect((await list()).some((s) => s.name === 'TS')).toBe(true);

    // React 로 이름을 바꾸면 기존 React 와 합쳐진다 (Next.js → React)
    const next = (await list()).find((s) => s.name === 'Next.js')!;
    const react = (await list()).find((s) => s.name === 'React')!;
    const merged = await agent.patch(`/api/v1/admin/skills/${next.id}`).send({ name: 'react' });
    expect(merged.body).toEqual({ merged: true, id: react.id });
    const after = await list();
    expect(after.find((s) => s.name === 'Next.js')).toBeUndefined();
    expect(after.find((s) => s.name === 'React')!.projectCount).toBe(react.projectCount + 1);

    expect((await agent.delete(`/api/v1/admin/skills/${ts.id}`)).status).toBe(204);
    expect((await list()).some((s) => s.id === ts.id)).toBe(false);
  });

  it('adds link-type deliverables but rejects image type and bad URLs', async () => {
    const projectId = (await agent.get('/api/v1/admin/projects?q=portfolio-platform')).body.items[0].id;
    const link = await agent.post('/api/v1/admin/assets').send({ projectId, type: 'DEMO', title: '데모 영상', url: 'https://youtu.be/x', visibility: 'PUBLIC' });
    expect(link.status).toBe(201);
    expect(link.body).toMatchObject({ type: 'DEMO', uploaded: false });

    expect((await agent.post('/api/v1/admin/assets').send({ projectId, type: 'IMAGE', title: 'x', url: 'https://a.com/x.png' })).status).toBe(400);
    expect((await agent.post('/api/v1/admin/assets').send({ projectId, title: 'x', url: 'javascript:alert(1)' })).status).toBe(400);

    const pub = await ctx.http.get('/api/v1/public/projects/portfolio-platform');
    expect(pub.body.assets.map((a: { title: string }) => a.title)).toContain('데모 영상');

    expect((await agent.delete(`/api/v1/admin/assets/${link.body.id}`)).status).toBe(204);
  });

  it('isolates careers, keywords and assets between owners', async () => {
    await seed(ctx.database.db, { email: 'p8-other@example.com', password: 'other-password-8', withSampleData: false });
    const other = await loginAgent(ctx, { email: 'p8-other@example.com', password: 'other-password-8' });
    const career = (await agent.get('/api/v1/admin/careers')).body.items[0];
    const skill = (await agent.get('/api/v1/admin/skills')).body.items[0];
    const projectId = (await agent.get('/api/v1/admin/projects')).body.items[0].id;

    expect((await other.patch(`/api/v1/admin/careers/${career.id}`).send({ company: 'x' })).status).toBe(404);
    expect((await other.delete(`/api/v1/admin/skills/${skill.id}`)).status).toBe(404);
    expect((await other.post('/api/v1/admin/assets').send({ projectId, title: 'x', url: 'https://x.com' })).status).toBe(404);
    expect((await other.get('/api/v1/admin/careers')).body.items).toHaveLength(0);
  });
});
