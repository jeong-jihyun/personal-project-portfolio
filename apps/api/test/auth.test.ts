import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sessions } from '../src/db/schema.js';
import { loginAgent, OWNER, setupApp, type TestContext } from './helpers.js';

const cookieOf = (res: { headers: Record<string, unknown> }) =>
  ([] as string[]).concat((res.headers['set-cookie'] as string[] | string | undefined) ?? []).join('; ');

describe('auth & sessions', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setupApp();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('logs in and issues an httpOnly, SameSite=Lax session cookie scoped to /api', async () => {
    const res = await ctx.http.post('/api/v1/auth/session').send(OWNER);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(OWNER.email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = cookieOf(res);
    expect(cookie).toMatch(/pps_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api/);
  });

  it('stores only a hash of the session token', async () => {
    const res = await ctx.http.post('/api/v1/auth/session').send(OWNER);
    const token = /pps_session=([^;]+)/.exec(cookieOf(res))![1]!;
    const rows = await ctx.database.db.select().from(sessions);
    expect(rows.some((r) => r.id === token)).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.id))).toBe(true);
  });

  it('rejects wrong credentials with the same message for unknown users', async () => {
    const wrongPw = await ctx.http.post('/api/v1/auth/session').send({ email: OWNER.email, password: 'nope-nope-nope' });
    const noUser = await ctx.http.post('/api/v1/auth/session').send({ email: 'ghost@example.com', password: 'whatever-123' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.code).toBe('INVALID_CREDENTIALS');
    expect(noUser.body.message).toBe(wrongPw.body.message);
  });

  it('validates the login payload with field-level details', async () => {
    const res = await ctx.http.post('/api/v1/auth/session').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const paths = (res.body.details as { path: string }[]).map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('protects admin endpoints and returns the current user when logged in', async () => {
    expect((await ctx.http.get('/api/v1/auth/session')).status).toBe(401);
    expect((await ctx.http.get('/api/v1/admin/activities')).status).toBe(401);
    const agent = await loginAgent(ctx);
    const me = await agent.get('/api/v1/auth/session');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(OWNER.email);
  });

  it('records login activity visible only to the owner', async () => {
    const agent = await loginAgent(ctx);
    const res = await agent.get('/api/v1/admin/activities');
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ entityType: 'SESSION', action: 'LOGIN' });
  });

  it('invalidates the session on logout', async () => {
    const agent = await loginAgent(ctx);
    expect((await agent.delete('/api/v1/auth/session')).status).toBe(204);
    expect((await agent.get('/api/v1/auth/session')).status).toBe(401);
  });

  it('rejects state-changing requests from foreign origins', async () => {
    const foreign = await ctx.http.post('/api/v1/auth/session').set('Origin', 'https://evil.example').send(OWNER);
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe('FORBIDDEN_ORIGIN');
    const allowed = await ctx.http.post('/api/v1/auth/session').set('Origin', 'http://localhost:5173').send(OWNER);
    expect(allowed.status).toBe(201);
  });

  it('rate-limits repeated failed logins', async () => {
    const creds = { email: 'limit@example.com', password: 'wrong-password' };
    for (let i = 0; i < 5; i++) {
      expect((await ctx.http.post('/api/v1/auth/session').send(creds)).status).toBe(401);
    }
    const blocked = await ctx.http.post('/api/v1/auth/session').send(creds);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS');
  });
});
