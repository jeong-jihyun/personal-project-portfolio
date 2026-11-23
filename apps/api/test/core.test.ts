import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupApp, type TestContext } from './helpers.js';

describe('API core', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setupApp();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('serves health under /api/v1 with a trace id header', async () => {
    const res = await ctx.http.get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['x-trace-id']).toBeTruthy();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await ctx.http.get('/api/v1/nope').set('X-Request-Id', 'trace-abc-123');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND', traceId: 'trace-abc-123' });
    expect(typeof res.body.message).toBe('string');
  });

  it('rejects malformed JSON with INVALID_JSON', async () => {
    const res = await ctx.http
      .post('/api/v1/auth/session')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });

  it('publishes an OpenAPI document', async () => {
    const res = await ctx.http.get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.info.title).toContain('Portfolio');
  });
});
