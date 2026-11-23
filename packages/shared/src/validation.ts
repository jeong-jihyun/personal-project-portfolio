/**
 * 입력 검증 스키마 (API 설계서 §2, 기능정의서 §3).
 * API 서버가 최종 검증을 수행하고, 프런트엔드는 같은 스키마로 즉시 피드백을 준다.
 */
import { z } from 'zod';
import {
  ASSET_TYPES,
  PROJECT_STATUSES,
  PUBLICATION_STATUSES,
  REPOSITORY_PROVIDERS,
  SKILL_CATEGORIES,
  VISIBILITIES,
} from './enums.js';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** undefined(미전송)는 유지하고, 빈 문자열·null은 null(값 삭제)로 정규화한다. PATCH 시 미전송 필드가 지워지지 않게 한다. */
function emptyToNull(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  return v ? v : null;
}

/** 선택 텍스트 필드. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max}자 이하로 입력하세요.`)
    .nullish()
    .transform(emptyToNull);

const requiredText = (max: number, label: string) =>
  z.string({ error: `${label}을(를) 입력하세요.` }).trim().min(1, `${label}을(를) 입력하세요.`).max(max, `${max}자 이하로 입력하세요.`);

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const optionalDate = z
  .string()
  .trim()
  .nullish()
  .transform(emptyToNull)
  .refine((v) => v == null || isValidDate(v), 'YYYY-MM-DD 형식의 날짜를 입력하세요.');

/** 허용 스킴: http, https. javascript:, data: 등은 거부한다. */
export function isWebUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname;
  } catch {
    return false;
  }
}

const SCP_SSH_PATTERN = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[A-Za-z0-9._~\/-]+(\.git)?$/;

/** 저장소 URL: https://, ssh:// 또는 git@host:owner/repo 형식. */
export function isRepositoryUrl(value: string): boolean {
  if (SCP_SSH_PATTERN.test(value)) return true;
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'ssh:') && !!u.hostname;
  } catch {
    return false;
  }
}

const optionalWebUrl = z
  .string()
  .trim()
  .max(2048)
  .nullish()
  .transform(emptyToNull)
  .refine((v) => v == null || isWebUrl(v), 'http(s):// 로 시작하는 URL을 입력하세요.');

const requiredWebUrl = z
  .string()
  .trim()
  .min(1, 'URL을 입력하세요.')
  .max(2048)
  .refine(isWebUrl, 'http(s):// 로 시작하는 URL을 입력하세요.');

/** 제목에서 slug 후보를 만든다. 한글 등 비 ASCII 문자는 제거되므로 결과가 비면 호출 측에서 대체값을 쓴다. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function checkPeriod(
  value: { startDate?: string | null; endDate?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: '종료일은 시작일보다 빠를 수 없습니다.',
    });
  }
}

// ── 인증 ─────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.email('이메일 형식이 올바르지 않습니다.').trim().toLowerCase(),
  password: z.string().min(1, '비밀번호를 입력하세요.').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── 목록 조회 표준 파라미터 ──────────────────────────
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().max(40).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  q: z.string().trim().max(100).optional(),
  status: z.string().trim().max(40).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

// ── 프로젝트 (F-001) ─────────────────────────────────
const projectFields = {
  title: requiredText(120, '프로젝트명'),
  slug: z
    .string()
    .trim()
    .max(80, '80자 이하로 입력하세요.')
    .nullish()
    .transform(emptyToNull)
    .refine((v) => v == null || SLUG_PATTERN.test(v), '영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.'),
  summary: optionalText(300),
  problem: optionalText(3000),
  description: optionalText(10000),
  status: z.enum(PROJECT_STATUSES).default('PLANNED'),
  visibility: z.enum(VISIBILITIES).default('PRIVATE'),
  startDate: optionalDate,
  endDate: optionalDate,
  role: optionalText(200),
  outcome: optionalText(3000),
  /** 서비스·데모 주소 (http/https만) */
  projectUrl: optionalWebUrl,
  skillIds: z.array(z.uuid()).max(50).optional(),
};

export const projectCreateSchema = z.object(projectFields).superRefine(checkPeriod);
export type ProjectCreateInput = z.input<typeof projectCreateSchema>;

export const projectUpdateSchema = z
  .object({
    title: projectFields.title.optional(),
    slug: projectFields.slug,
    summary: projectFields.summary,
    problem: projectFields.problem,
    description: projectFields.description,
    status: z.enum(PROJECT_STATUSES).optional(),
    visibility: z.enum(VISIBILITIES).optional(),
    startDate: projectFields.startDate,
    endDate: projectFields.endDate,
    role: projectFields.role,
    outcome: projectFields.outcome,
    projectUrl: projectFields.projectUrl,
    skillIds: projectFields.skillIds,
  })
  .superRefine(checkPeriod);
export type ProjectUpdateInput = z.input<typeof projectUpdateSchema>;

// ── 게시 설정 (F-006) ────────────────────────────────
export const publicationSchema = z.object({
  publicationStatus: z.enum(PUBLICATION_STATUSES).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  isFeatured: z.boolean().optional(),
});
export type PublicationInput = z.infer<typeof publicationSchema>;

export const portfolioOrderSchema = z.object({
  projectIds: z.array(z.uuid()).min(1).max(500),
});
export type PortfolioOrderInput = z.infer<typeof portfolioOrderSchema>;

// ── 저장소 (F-002) ───────────────────────────────────
const repositoryFields = {
  provider: z.enum(REPOSITORY_PROVIDERS).default('GITHUB'),
  name: requiredText(100, '저장소 이름'),
  url: z
    .string()
    .trim()
    .min(1, '저장소 URL을 입력하세요.')
    .max(2048)
    .refine(isRepositoryUrl, 'https://, ssh:// 또는 git@host:owner/repo 형식이어야 합니다.'),
  cloneUrl: z
    .string()
    .trim()
    .max(2048)
    .nullish()
    .transform(emptyToNull)
    .refine((v) => v == null || isRepositoryUrl(v), 'https://, ssh:// 또는 git@host:owner/repo 형식이어야 합니다.'),
  defaultBranch: optionalText(100),
  developmentBranch: optionalText(100),
  visibility: z.enum(VISIBILITIES).default('PRIVATE'),
  readmeUrl: optionalWebUrl,
  deploymentUrl: optionalWebUrl,
  isPrimary: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
};
export const repositoryCreateSchema = z.object(repositoryFields);
export type RepositoryCreateInput = z.input<typeof repositoryCreateSchema>;

export const repositoryUpdateSchema = z.object({
  provider: z.enum(REPOSITORY_PROVIDERS).optional(),
  name: repositoryFields.name.optional(),
  url: repositoryFields.url.optional(),
  cloneUrl: repositoryFields.cloneUrl,
  defaultBranch: repositoryFields.defaultBranch,
  developmentBranch: repositoryFields.developmentBranch,
  visibility: z.enum(VISIBILITIES).optional(),
  readmeUrl: repositoryFields.readmeUrl,
  deploymentUrl: repositoryFields.deploymentUrl,
  isPrimary: z.boolean().optional(),
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
});
export type RepositoryUpdateInput = z.input<typeof repositoryUpdateSchema>;

// ── 기술 스택 (F-003) ────────────────────────────────
const skillFields = {
  name: requiredText(60, '기술명'),
  proficiencyLabel: optionalText(40),
};
export const skillSchema = z.object({
  ...skillFields,
  category: z.enum(SKILL_CATEGORIES).default('OTHER'),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
});
export type SkillInput = z.input<typeof skillSchema>;
export const skillUpdateSchema = z.object({
  name: skillFields.name.optional(),
  proficiencyLabel: skillFields.proficiencyLabel,
  category: z.enum(SKILL_CATEGORIES).optional(),
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

// ── 경력 (F-005) ─────────────────────────────────────
const careerFields = {
  company: requiredText(120, '회사명'),
  position: requiredText(120, '직무'),
  startDate: z.string().trim().refine(isValidDate, 'YYYY-MM-DD 형식의 날짜를 입력하세요.'),
  endDate: optionalDate,
  description: optionalText(5000),
};
export const careerSchema = z
  .object({
    ...careerFields,
    visibility: z.enum(VISIBILITIES).default('PUBLIC'),
    displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  })
  .superRefine(checkPeriod);
export type CareerInput = z.input<typeof careerSchema>;
export const careerUpdateSchema = z
  .object({
    company: careerFields.company.optional(),
    position: careerFields.position.optional(),
    startDate: careerFields.startDate.optional(),
    endDate: careerFields.endDate,
    description: careerFields.description,
    visibility: z.enum(VISIBILITIES).optional(),
    displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
  })
  .superRefine(checkPeriod);

// ── 산출물 (F-004) ───────────────────────────────────
export const assetSchema = z.object({
  projectId: z.uuid('프로젝트를 선택하세요.'),
  type: z.enum(ASSET_TYPES).default('DOCUMENT'),
  title: requiredText(120, '산출물 제목'),
  url: requiredWebUrl,
  visibility: z.enum(VISIBILITIES).default('PRIVATE'),
  displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
});
export type AssetInput = z.input<typeof assetSchema>;
export const assetUpdateSchema = z.object({
  type: z.enum(ASSET_TYPES).optional(),
  title: requiredText(120, '산출물 제목').optional(),
  url: requiredWebUrl.optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

// ── 프로필 (F-006) ───────────────────────────────────
export const profileLinkSchema = z.object({
  label: requiredText(40, '링크 이름'),
  url: requiredWebUrl,
});
/** 프로필은 전체 교체(PUT) 방식이다. */
export const profileSchema = z.object({
  displayName: requiredText(60, '표시 이름'),
  headline: optionalText(160),
  bio: optionalText(5000),
  contactEmail: z
    .string()
    .trim()
    .nullish()
    .transform(emptyToNull)
    .refine((v) => v == null || z.email().safeParse(v).success, '이메일 형식이 올바르지 않습니다.'),
  location: optionalText(80),
  links: z.array(profileLinkSchema).max(10).default([]),
  publicationStatus: z.enum(PUBLICATION_STATUSES).default('DRAFT'),
});
export type ProfileInput = z.input<typeof profileSchema>;
