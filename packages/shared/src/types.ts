/** API 응답 DTO 타입. Admin DTO와 Public DTO를 분리해 비공개 필드가 공개 응답에 섞이지 않게 한다. */
import type {
  ActivityAction,
  AssetType,
  EntityType,
  ProjectStatus,
  PublicationStatus,
  RepositoryProvider,
  SkillCategory,
  Visibility,
} from './enums.js';

/** 오류 응답 표준 구조 (API 설계서 §2). */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  traceId: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
}

export interface SkillDto {
  id: string;
  name: string;
  category: SkillCategory;
  proficiencyLabel: string | null;
  displayOrder: number;
  projectCount?: number;
}

export interface RepositoryDto {
  id: string;
  projectId: string;
  provider: RepositoryProvider;
  name: string;
  url: string;
  cloneUrl: string | null;
  defaultBranch: string | null;
  developmentBranch: string | null;
  visibility: Visibility;
  readmeUrl: string | null;
  deploymentUrl: string | null;
  isPrimary: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 저장소 전체 목록(ADM-05)용: 소속 프로젝트명 포함. */
export interface RepositoryWithProjectDto extends RepositoryDto {
  projectTitle: string;
}

export interface AssetDto {
  id: string;
  projectId: string;
  type: AssetType;
  title: string;
  url: string;
  visibility: Visibility;
  displayOrder: number;
  createdAt: string;
}

export interface ProjectSummaryDto {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  /** 서비스·데모 주소 */
  projectUrl: string | null;
  status: ProjectStatus;
  visibility: Visibility;
  publicationStatus: PublicationStatus;
  isFeatured: boolean;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  repositoryCount: number;
  skills: Pick<SkillDto, 'id' | 'name'>[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetailDto extends ProjectSummaryDto {
  problem: string | null;
  description: string | null;
  role: string | null;
  outcome: string | null;
  repositories: RepositoryDto[];
  assets: AssetDto[];
}

export interface CareerDto {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
  visibility: Visibility;
  displayOrder: number;
}

export interface ProfileLink {
  label: string;
  url: string;
}

export interface ProfileDto {
  displayName: string;
  headline: string | null;
  bio: string | null;
  contactEmail: string | null;
  location: string | null;
  links: ProfileLink[];
  publicationStatus: PublicationStatus;
  updatedAt: string | null;
}

export interface ActivityDto {
  id: string;
  entityType: EntityType;
  entityId: string | null;
  action: ActivityAction;
  summary: string | null;
  createdAt: string;
}

export interface DashboardDto {
  totalProjects: number;
  byStatus: Record<ProjectStatus, number>;
  publishedProjects: number;
  publicRepositories: number;
  totalRepositories: number;
  recentProjects: ProjectSummaryDto[];
  recentActivities: ActivityDto[];
  profilePublished: boolean;
}

/** 삭제 전 연관 데이터 영향 안내 (UI 설계서 §6). */
export interface ProjectDeleteImpactDto {
  repositories: number;
  assets: number;
  skills: number;
}

// ── Public DTO ──────────────────────────────────────
// 비공개 저장소·clone URL·내부 산출물·관리용 필드는 포함하지 않는다 (API 설계서 §5).

export interface PublicRepositoryDto {
  provider: RepositoryProvider;
  name: string;
  url: string;
  readmeUrl: string | null;
  deploymentUrl: string | null;
  isPrimary: boolean;
}

export interface PublicAssetDto {
  type: AssetType;
  title: string;
  url: string;
}

export interface PublicSkillDto {
  name: string;
  category: SkillCategory;
  proficiencyLabel: string | null;
}

export interface PublicProjectSummaryDto {
  slug: string;
  title: string;
  summary: string | null;
  projectUrl: string | null;
  status: ProjectStatus;
  isFeatured: boolean;
  startDate: string | null;
  endDate: string | null;
  skills: string[];
}

export interface PublicProjectDetailDto extends PublicProjectSummaryDto {
  problem: string | null;
  description: string | null;
  role: string | null;
  outcome: string | null;
  repositories: PublicRepositoryDto[];
  assets: PublicAssetDto[];
}

export interface PublicCareerDto {
  company: string;
  position: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface PublicSkillGroupDto {
  category: SkillCategory;
  skills: (PublicSkillDto & { projects: { slug: string; title: string }[] })[];
}

export interface PublicProfileDto {
  displayName: string;
  headline: string | null;
  bio: string | null;
  contactEmail: string | null;
  location: string | null;
  links: ProfileLink[];
}
