/**
 * 핵심 데이터 모델 (API 설계서 §4).
 * - 모든 소유 리소스는 ownerId(직접 또는 project를 통해)로 격리해 다중 사용자 확장 여지를 둔다.
 * - 대표 저장소 1개 제한, slug 고유, 기간 검증은 DB 제약으로도 이중 보장한다.
 * - 삭제 정책: hard delete + 연관 저장소·기술 연결·산출물 cascade (기능정의서 §3 결정사항).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  ACTIVITY_ACTIONS,
  ASSET_TYPES,
  ENTITY_TYPES,
  PROJECT_STATUSES,
  PUBLICATION_STATUSES,
  REPOSITORY_PROVIDERS,
  SKILL_CATEGORIES,
  VISIBILITIES,
  type ProfileLink,
} from '@ppp/shared';

export const projectStatusEnum = pgEnum('project_status', PROJECT_STATUSES);
export const visibilityEnum = pgEnum('visibility', VISIBILITIES);
export const publicationStatusEnum = pgEnum('publication_status', PUBLICATION_STATUSES);
export const repositoryProviderEnum = pgEnum('repository_provider', REPOSITORY_PROVIDERS);
export const assetTypeEnum = pgEnum('asset_type', ASSET_TYPES);
export const skillCategoryEnum = pgEnum('skill_category', SKILL_CATEGORIES);
export const activityActionEnum = pgEnum('activity_action', ACTIVITY_ACTIONS);
export const entityTypeEnum = pgEnum('entity_type', ENTITY_TYPES);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  authProvider: text('auth_provider').notNull().default('LOCAL'),
  passwordHash: text('password_hash'),
  createdAt: createdAt(),
});

/** 서버 측 세션. 토큰 원문은 쿠키에만 있고 DB에는 SHA-256 해시만 저장한다. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  headline: text('headline'),
  bio: text('bio'),
  contactEmail: text('contact_email'),
  location: text('location'),
  links: jsonb('links').$type<ProfileLink[]>().notNull().default([]),
  publicationStatus: publicationStatusEnum('publication_status').notNull().default('DRAFT'),
  updatedAt: updatedAt(),
});

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary'),
    problem: text('problem'),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('PLANNED'),
    visibility: visibilityEnum('visibility').notNull().default('PRIVATE'),
    publicationStatus: publicationStatusEnum('publication_status').notNull().default('DRAFT'),
    isFeatured: boolean('is_featured').notNull().default(false),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    role: text('role'),
    outcome: text('outcome'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('projects_slug_unique').on(t.slug),
    index('projects_owner_idx').on(t.ownerId),
    check('projects_period_check', sql`${t.endDate} IS NULL OR ${t.startDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
  ],
);

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    provider: repositoryProviderEnum('provider').notNull().default('GITHUB'),
    name: text('name').notNull(),
    url: text('url').notNull(),
    cloneUrl: text('clone_url'),
    defaultBranch: text('default_branch'),
    developmentBranch: text('development_branch'),
    visibility: visibilityEnum('visibility').notNull().default('PRIVATE'),
    readmeUrl: text('readme_url'),
    deploymentUrl: text('deployment_url'),
    isPrimary: boolean('is_primary').notNull().default(false),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('repositories_project_idx').on(t.projectId),
    // 프로젝트당 대표 저장소 최대 1개 (기능정의서 §3)
    uniqueIndex('repositories_one_primary_per_project').on(t.projectId).where(sql`${t.isPrimary} = true`),
  ],
);

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: skillCategoryEnum('category').notNull().default('OTHER'),
    proficiencyLabel: text('proficiency_label'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('skills_owner_name_unique').on(t.ownerId, sql`lower(${t.name})`)],
);

export const projectSkills = pgTable(
  'project_skills',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.skillId] }), index('project_skills_skill_idx').on(t.skillId)],
);

export const careers = pgTable(
  'careers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    company: text('company').notNull(),
    position: text('position').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    description: text('description'),
    visibility: visibilityEnum('visibility').notNull().default('PUBLIC'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('careers_owner_idx').on(t.ownerId),
    check('careers_period_check', sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
  ],
);

export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    type: assetTypeEnum('type').notNull().default('DOCUMENT'),
    title: text('title').notNull(),
    url: text('url').notNull(),
    visibility: visibilityEnum('visibility').notNull().default('PRIVATE'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('assets_project_idx').on(t.projectId)],
);

/** 관리자 변경 감사 이력 (F-008). */
export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    entityType: entityTypeEnum('entity_type').notNull(),
    entityId: uuid('entity_id'),
    action: activityActionEnum('action').notNull(),
    summary: text('summary'),
    createdAt: createdAt(),
  },
  (t) => [index('activities_actor_created_idx').on(t.actorId, t.createdAt)],
);

export const schema = {
  users,
  sessions,
  profiles,
  projects,
  repositories,
  skills,
  projectSkills,
  careers,
  assets,
  activities,
};
