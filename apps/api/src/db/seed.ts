/**
 * 초기 소유자 계정과 예시 데이터. 이미 소유자가 있으면 아무것도 하지 않는다(멱등).
 * 예시 저장소 URL은 github.com/example/... 자리표시자이므로 실제 주소로 교체해야 한다.
 */
import { eq } from 'drizzle-orm';
import type { Database } from './database.js';
import { careers, profiles, projectSkills, projects, repositories, skills, users } from './schema.js';
import { hashPassword } from '../auth/password.js';

export interface SeedOptions {
  email: string;
  password: string;
  /** 미리 계산한 scrypt 해시. 있으면 password 대신 사용한다. */
  passwordHash?: string;
  displayName?: string;
  /** false면 계정·빈 프로필만 만든다. */
  withSampleData?: boolean;
}

export async function seed(db: Database, options: SeedOptions): Promise<{ created: boolean; userId: string }> {
  const email = options.email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing[0]) return { created: false, userId: existing[0].id };

  const displayName = options.displayName ?? '포트폴리오 소유자';
  const passwordHash = options.passwordHash || (await hashPassword(options.password));

  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, displayName, passwordHash }).returning({ id: users.id });
    const ownerId = user!.id;

    await tx.insert(profiles).values({
      userId: ownerId,
      displayName,
      headline: '문제를 구조화하고, 서비스로 구현합니다.',
      bio: '프로젝트의 목표와 역할, 기술적 선택, 결과를 기록하는 개인 개발 포트폴리오입니다.',
      links: [],
      publicationStatus: options.withSampleData === false ? 'DRAFT' : 'PUBLISHED',
    });

    if (options.withSampleData === false) return { created: true, userId: ownerId };

    const skillRows = await tx
      .insert(skills)
      .values([
        { ownerId, name: 'TypeScript', category: 'LANGUAGE', displayOrder: 1 },
        { ownerId, name: 'React', category: 'FRONTEND', displayOrder: 2 },
        { ownerId, name: 'NestJS', category: 'BACKEND', displayOrder: 3 },
        { ownerId, name: 'PostgreSQL', category: 'DATABASE', displayOrder: 4 },
        { ownerId, name: 'Node.js', category: 'BACKEND', displayOrder: 5 },
        { ownerId, name: 'Next.js', category: 'FRONTEND', displayOrder: 6 },
      ])
      .returning({ id: skills.id, name: skills.name });
    const skillId = (name: string) => skillRows.find((s) => s.name === name)!.id;

    const [p1, p2, p3] = await tx
      .insert(projects)
      .values([
        {
          ownerId,
          title: '프로젝트 포트폴리오 플랫폼',
          slug: 'portfolio-platform',
          summary: '개인 프로젝트와 개발 이력을 통합 관리하는 포트폴리오 서비스',
          problem: '프로젝트 정보·저장소·산출물이 여러 곳에 흩어져 있어 이력을 일관되게 보여주기 어려웠다.',
          description: '관리자 화면에서 프로젝트·저장소·경력을 관리하고, 공개 정책에 따라 선택적으로 외부에 공개한다.',
          status: 'IN_PROGRESS',
          visibility: 'PUBLIC',
          publicationStatus: 'PUBLISHED',
          isFeatured: true,
          startDate: '2026-09-01',
          role: '기획·설계·개발',
          outcome: '관리와 공개 포트폴리오의 통합 관리',
          sortOrder: 1,
        },
        {
          ownerId,
          title: '자동화 워크플로 빌더',
          slug: 'workflow-builder',
          summary: '반복 업무를 시각적 워크플로로 구성하는 자동화 도구',
          status: 'PLANNED',
          visibility: 'PRIVATE',
          publicationStatus: 'DRAFT',
          role: '아키텍처 설계',
          outcome: '워크플로 버전 및 실행 구조 설계',
          sortOrder: 2,
        },
        {
          ownerId,
          title: '개인 지식 관리 도구',
          slug: 'knowledge-manager',
          summary: '기술 학습과 업무 지식을 구조화하는 지식 관리 도구',
          status: 'COMPLETED',
          visibility: 'PUBLIC',
          publicationStatus: 'PUBLISHED',
          startDate: '2026-03-01',
          endDate: '2026-06-30',
          role: '설계·개발',
          outcome: '지식 문서화 흐름 구축',
          sortOrder: 3,
        },
      ])
      .returning({ id: projects.id });

    await tx.insert(repositories).values([
      {
        projectId: p1!.id,
        provider: 'GITHUB',
        name: 'portfolio-web',
        url: 'https://github.com/example/portfolio-web',
        defaultBranch: 'main',
        visibility: 'PUBLIC',
        isPrimary: true,
        displayOrder: 1,
      },
      {
        projectId: p1!.id,
        provider: 'GITHUB',
        name: 'portfolio-api',
        url: 'https://github.com/example/portfolio-api',
        defaultBranch: 'main',
        developmentBranch: 'develop',
        visibility: 'PRIVATE',
        displayOrder: 2,
      },
    ]);

    await tx.insert(projectSkills).values([
      { projectId: p1!.id, skillId: skillId('React') },
      { projectId: p1!.id, skillId: skillId('NestJS') },
      { projectId: p1!.id, skillId: skillId('PostgreSQL') },
      { projectId: p2!.id, skillId: skillId('Node.js') },
      { projectId: p3!.id, skillId: skillId('Next.js') },
    ]);

    await tx.insert(careers).values({
      ownerId,
      company: '예시 회사 (실제 경력으로 교체하세요)',
      position: 'IT 시스템 개발',
      startDate: '2020-01-01',
      description: '분석·설계·개발',
      visibility: 'PUBLIC',
      displayOrder: 1,
    });

    return { created: true, userId: ownerId };
  });
}
