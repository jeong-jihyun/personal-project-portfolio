import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { PROJECT_STATUSES, type DashboardDto, type ProjectStatus } from '@ppp/shared';
import { ActivityService } from '../activity/activity.service.js';
import { DB } from '../common/tokens.js';
import type { Database } from '../db/database.js';
import { profiles, projects, repositories } from '../db/schema.js';
import { toProjectSummaries } from '../projects/project.queries.js';

/** ADM-01 대시보드: 프로젝트 KPI, 최근 수정, 공개 상태, 최근 활동. 모든 집계는 본인 소유 데이터만. */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  async get(ownerId: string): Promise<DashboardDto> {
    const owned = eq(projects.ownerId, ownerId);

    const [statusRows, [published], repoRows, recentRows, recentActivities, [profile]] = await Promise.all([
      this.db.select({ status: projects.status, n: count() }).from(projects).where(owned).groupBy(projects.status),
      this.db
        .select({ n: count() })
        .from(projects)
        .where(and(owned, eq(projects.publicationStatus, 'PUBLISHED'), eq(projects.visibility, 'PUBLIC'))),
      this.db
        .select({ visibility: repositories.visibility, n: count() })
        .from(repositories)
        .innerJoin(projects, eq(projects.id, repositories.projectId))
        .where(owned)
        .groupBy(repositories.visibility),
      this.db.select().from(projects).where(owned).orderBy(desc(projects.updatedAt)).limit(5),
      this.activity.recent(ownerId, 8),
      this.db.select({ status: profiles.publicationStatus }).from(profiles).where(eq(profiles.userId, ownerId)),
    ]);

    const byStatus = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0])) as Record<ProjectStatus, number>;
    for (const r of statusRows) byStatus[r.status] = Number(r.n);

    return {
      totalProjects: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      publishedProjects: Number(published?.n ?? 0),
      publicRepositories: Number(repoRows.find((r) => r.visibility === 'PUBLIC')?.n ?? 0),
      totalRepositories: repoRows.reduce((sum, r) => sum + Number(r.n), 0),
      recentProjects: await toProjectSummaries(this.db, recentRows),
      recentActivities,
      profilePublished: profile?.status === 'PUBLISHED',
    };
  }
}
