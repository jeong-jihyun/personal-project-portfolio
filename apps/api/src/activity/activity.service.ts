import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { ActivityAction, ActivityDto, EntityType } from '@ppp/shared';
import { DB } from '../common/tokens.js';
import { toIso } from '../common/pagination.js';
import type { Database } from '../db/database.js';
import { activities } from '../db/schema.js';

/** 트랜잭션 안에서도 호출할 수 있도록 실행 대상(db 또는 tx)을 받는다. */
type Executor = Pick<Database, 'insert'>;

export interface ActivityEntry {
  actorId: string;
  entityType: EntityType;
  entityId?: string | null;
  action: ActivityAction;
  summary?: string | null;
}

/** 관리자 데이터 변경 감사 이력 (F-008). */
@Injectable()
export class ActivityService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async log(entry: ActivityEntry, executor: Executor = this.db): Promise<void> {
    await executor.insert(activities).values({
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      action: entry.action,
      summary: entry.summary ? entry.summary.slice(0, 300) : null,
    });
  }

  async recent(actorId: string, limit = 20): Promise<ActivityDto[]> {
    const rows = await this.db
      .select()
      .from(activities)
      .where(eq(activities.actorId, actorId))
      .orderBy(desc(activities.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      action: r.action,
      summary: r.summary,
      createdAt: toIso(r.createdAt),
    }));
  }
}
