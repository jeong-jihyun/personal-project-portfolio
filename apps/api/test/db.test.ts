import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseHandle } from '../src/db/database.js';
import { seed } from '../src/db/seed.js';
import { projects, repositories } from '../src/db/schema.js';
import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('database schema & seed', () => {
  let h: DatabaseHandle;
  beforeAll(async () => {
    h = await createDatabase({ pgliteDataDir: 'memory://' });
    await h.migrate();
  });
  afterAll(async () => {
    await h.close();
  });

  it('seeds idempotently', async () => {
    const first = await seed(h.db, { email: 'Owner@Example.com', password: 'x'.repeat(12) });
    const second = await seed(h.db, { email: 'owner@example.com', password: 'x'.repeat(12) });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);
    expect(await h.db.select().from(projects)).toHaveLength(3);
  });

  it('enforces one primary repository per project at the DB level', async () => {
    const [p] = await h.db.select().from(projects);
    await h.db.update(repositories).set({ isPrimary: false });
    await h.db.insert(repositories).values({ projectId: p!.id, name: 'a', url: 'https://g.com/a', isPrimary: true });
    await expect(
      h.db.insert(repositories).values({ projectId: p!.id, name: 'b', url: 'https://g.com/b', isPrimary: true }),
    ).rejects.toThrow();
  });

  it('enforces the project period check constraint', async () => {
    const [p] = await h.db.select().from(projects);
    await expect(
      h.db.insert(projects).values({
        ownerId: p!.ownerId,
        title: 't',
        slug: 'bad-period',
        startDate: '2026-05-02',
        endDate: '2026-05-01',
      }),
    ).rejects.toThrow();
  });
});

describe('password hashing', () => {
  it('verifies correct passwords only', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('x', null)).toBe(false);
  });
});
