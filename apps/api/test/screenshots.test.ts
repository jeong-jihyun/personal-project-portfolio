import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seed } from '../src/db/seed.js';
import { loginAgent, setupApp, type TestContext } from './helpers.js';

// 1x1 투명 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
// 2x3 GIF
const GIF = Buffer.from('R0lGODlhAgADAIAAAP///wAAACH5BAEAAAAALAAAAAACAAMAAAICjI8AOw==', 'base64');

describe('project screenshots', () => {
  let ctx: TestContext;
  let agent: Awaited<ReturnType<typeof loginAgent>>;
  let projectId: string;
  let uploadDir: string;

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'pps-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    ctx = await setupApp({ sampleData: true });
    agent = await loginAgent(ctx);
    projectId = (await agent.get('/api/v1/admin/projects?q=workflow-builder')).body.items[0].id;
  });
  afterAll(async () => {
    await ctx.close();
    delete process.env.UPLOAD_DIR;
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const upload = (buf: Buffer, name = 'shot.png', title?: string) => {
    const req = agent.post(`/api/v1/admin/projects/${projectId}/screenshots`).attach('file', buf, name);
    return title ? req.field('title', title) : req;
  };
  const files = () => readdirSync(path.join(uploadDir, 'projects')).length;

  it('requires login', async () => {
    const res = await ctx.http.post(`/api/v1/admin/projects/${projectId}/screenshots`).attach('file', PNG, 'a.png');
    expect(res.status).toBe(401);
  });

  it('uploads an image, detects its real type and size, and serves it', async () => {
    const res = await upload(PNG, '메인 화면.png');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'IMAGE', title: '메인 화면', uploaded: true, width: 1, height: 1, visibility: 'PUBLIC' });
    expect(res.body.url).toMatch(/^\/api\/v1\/uploads\/projects\/[a-z0-9-]+\.png$/);

    const file = await ctx.http.get(res.body.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['x-content-type-options']).toBe('nosniff');

    const gif = await upload(GIF, 'anim.gif', '애니메이션');
    expect(gif.body).toMatchObject({ title: '애니메이션', width: 2, height: 3 });
    expect(gif.body.url).toMatch(/\.gif$/);
  });

  it('rejects disguised, SVG, empty and oversized files', async () => {
    const before = files();
    const fake = await upload(Buffer.from('hello this is not an image at all'), 'evil.png');
    expect(fake.status).toBe(400);
    expect(fake.body.code).toBe('UNSUPPORTED_IMAGE');

    const svg = await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg');
    expect(svg.status).toBe(400);

    const none = await agent.post(`/api/v1/admin/projects/${projectId}/screenshots`).field('title', 'x');
    expect(none.status).toBe(400);

    const big = await upload(Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024)]), 'big.png');
    expect(big.status).toBe(413);
    expect(big.body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(files()).toBe(before);
  });

  it('uses the first image as the cover and reorders', async () => {
    const detail = await agent.get(`/api/v1/admin/projects/${projectId}`);
    const images = detail.body.assets.filter((a: { type: string }) => a.type === 'IMAGE');
    expect(images).toHaveLength(2);

    const list = await agent.get('/api/v1/admin/projects?q=workflow-builder');
    expect(list.body.items[0].coverImageUrl).toBe(images[0].url);

    const re = await agent.patch(`/api/v1/admin/projects/${projectId}/screenshots/order`).send({ assetIds: [images[1].id] });
    expect(re.status).toBe(200);
    expect(re.body.items.map((a: { id: string }) => a.id)).toEqual([images[1].id, images[0].id]);
    const after = await agent.get('/api/v1/admin/projects?q=workflow-builder');
    expect(after.body.items[0].coverImageUrl).toBe(images[1].url);
  });

  it('updates title and visibility, then deletes the image and its file', async () => {
    const created = await upload(PNG, 'temp.png');
    const patched = await agent.patch(`/api/v1/admin/screenshots/${created.body.id}`).send({ title: '로그인 화면', visibility: 'PRIVATE' });
    expect(patched.body).toMatchObject({ title: '로그인 화면', visibility: 'PRIVATE' });

    const before = files();
    expect((await agent.delete(`/api/v1/admin/screenshots/${created.body.id}`)).status).toBe(204);
    expect(files()).toBe(before - 1);
    expect((await ctx.http.get(created.body.url)).status).toBe(404);
  });

  it('isolates screenshots between owners', async () => {
    await seed(ctx.database.db, { email: 'shot-other@example.com', password: 'other-password-3', withSampleData: false });
    const other = await loginAgent(ctx, { email: 'shot-other@example.com', password: 'other-password-3' });
    const detail = await agent.get(`/api/v1/admin/projects/${projectId}`);
    const imageId = detail.body.assets[0].id;

    expect((await other.post(`/api/v1/admin/projects/${projectId}/screenshots`).attach('file', PNG, 'a.png')).status).toBe(404);
    expect((await other.patch(`/api/v1/admin/screenshots/${imageId}`).send({ title: 'x' })).status).toBe(404);
    expect((await other.delete(`/api/v1/admin/screenshots/${imageId}`)).status).toBe(404);
  });

  it('removes uploaded files when the project is deleted', async () => {
    expect(files()).toBeGreaterThan(0);
    expect((await agent.delete(`/api/v1/admin/projects/${projectId}`)).status).toBe(204);
    expect(files()).toBe(0);
  });

  it('blocks path traversal on the local file route', async () => {
    expect((await ctx.http.get('/api/v1/uploads/..%2F..%2Fpackage.json/x.png')).status).toBe(404);
    expect((await ctx.http.get('/api/v1/uploads/projects/..%2F..%2Fsecret.png')).status).toBe(404);
  });
});
