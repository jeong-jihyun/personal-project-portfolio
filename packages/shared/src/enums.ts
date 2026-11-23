/** 도메인 열거형과 화면 표시용 한글 라벨 (기능정의서 F-001 ~ F-007). */

export const PROJECT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: '기획',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
};

export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  PUBLIC: '공개',
  PRIVATE: '비공개',
};

export const PUBLICATION_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export const PUBLICATION_STATUS_LABEL: Record<PublicationStatus, string> = {
  DRAFT: '비게시',
  PUBLISHED: '게시',
};

export const REPOSITORY_PROVIDERS = ['GITHUB', 'GITLAB', 'BITBUCKET', 'OTHER'] as const;
export type RepositoryProvider = (typeof REPOSITORY_PROVIDERS)[number];
export const REPOSITORY_PROVIDER_LABEL: Record<RepositoryProvider, string> = {
  GITHUB: 'GitHub',
  GITLAB: 'GitLab',
  BITBUCKET: 'Bitbucket',
  OTHER: '기타',
};

export const ASSET_TYPES = ['DOCUMENT', 'IMAGE', 'DEMO', 'DEPLOYMENT', 'OTHER'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];
export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  DOCUMENT: '문서',
  IMAGE: '이미지',
  DEMO: '데모',
  DEPLOYMENT: '배포 링크',
  OTHER: '기타',
};

export const SKILL_CATEGORIES = [
  'LANGUAGE',
  'FRONTEND',
  'BACKEND',
  'DATABASE',
  'DEVOPS',
  'TOOL',
  'OTHER',
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];
export const SKILL_CATEGORY_LABEL: Record<SkillCategory, string> = {
  LANGUAGE: '언어',
  FRONTEND: '프런트엔드',
  BACKEND: '백엔드',
  DATABASE: '데이터베이스',
  DEVOPS: 'DevOps·인프라',
  TOOL: '도구',
  OTHER: '기타',
};

export const ACTIVITY_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'UNPUBLISH', 'REORDER', 'LOGIN'] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ENTITY_TYPES = ['PROJECT', 'REPOSITORY', 'SKILL', 'CAREER', 'ASSET', 'PROFILE', 'PORTFOLIO', 'SESSION'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
