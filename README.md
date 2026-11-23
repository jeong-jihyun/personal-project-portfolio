# Personal Project Portfolio

개인 개발 프로젝트의 정보·성과·Git 저장소·스크린샷·경력을 한곳에서 관리하고, 선택한 내용만 공개 포트폴리오로 보여 주는 서비스입니다.
설계 문서: [`docs/`](docs/README.md) (API 설계서, 기능정의서, UI 설계서, 디자인 시스템 v2.0)

- **공개 포트폴리오**: https://personal-project-portfolio-pi.vercel.app (`/portfolio`)
- **관리자**: https://personal-project-portfolio-pi.vercel.app/admin
- **API 문서(OpenAPI)**: https://personal-project-portfolio-pi.vercel.app/api/docs

## 구성

```
apps/
  api/          NestJS 백엔드 (모듈형 모놀리스) — /api/v1/admin · /api/v1/public · /api/v1/auth
  admin-web/    관리자 화면 (React + Vite, /admin)
  public-web/   공개 포트폴리오 (React + Vite, /portfolio)
packages/
  shared/       공용 검증 규칙(zod)·응답 타입·경력 텍스트 변환
  design-tokens/ 색상·글꼴·간격 토큰과 기본 컴포넌트 CSS
scripts/
  vercel-build.mjs  Vercel 배포 빌드 (마이그레이션 → API 함수 번들 → 화면 빌드)
```

| 구분 | 사용 기술 |
|---|---|
| 백엔드 | NestJS 12, Drizzle ORM, PostgreSQL(운영: Neon) / PGlite(로컬) |
| 프런트엔드 | React 19, React Router 7, Vite 8 |
| 파일 저장 | Vercel Blob(운영) / `.data/uploads`(로컬) |
| 배포 | Vercel (GitHub `main` 푸시 시 자동 배포), 함수 리전 싱가포르 |

## 주요 기능

| 관리자 | 공개 화면 |
|---|---|
| 대시보드(현황·최근 활동) | 홈: 소개, 프로젝트(태그 + 갤러리 카드), 최근 경력, 연락 |
| 프로젝트 등록·수정·삭제, 키워드(#해시태그), 프로젝트 URL | 프로젝트 목록(키워드 필터) |
| 스크린샷: 파일 선택·끌어다 놓기·**Ctrl+V 붙여넣기**·모바일 촬영 | 프로젝트 상세: 스크린샷 갤러리, 문제→역할→수행→결과 |
| Git 저장소 여러 개, 대표 저장소 1개, 저장소별 공개 여부 | 공개 저장소·서비스 링크 |
| **GitHub에서 가져오기**: 공개·비공개 저장소 일괄 등록(새 프로젝트는 비공개·비게시) | 경력 페이지(`/career`), 홈은 최근 경력 3건 |
| 게시하기/게시 해제, 대표 프로젝트 | |
| 경력: 마크다운 편집기로 한 번에 붙여넣기 | |
| 프로필·외부 링크, 키워드 정리, 비밀번호 변경 | |

**공개 범위는 서버가 최종 결정합니다.** 공개 API는 `공개 + 게시`된 프로젝트만, 그 안에서도 공개로 둔 저장소·스크린샷·링크만 내보냅니다. clone URL·내부 ID 같은 관리용 정보는 공개 응답에 포함하지 않습니다.

## 로컬에서 실행

준비물: Node.js 20 이상, pnpm 8

```bash
pnpm install
cp .env.example .env          # ADMIN_EMAIL / ADMIN_PASSWORD 를 원하는 값으로
pnpm dev:memory               # 메모리 DB + 예시 데이터로 API·관리자 화면 실행 (추천)
```

- 관리자: http://localhost:5173/admin (`.env` 의 ADMIN_EMAIL / ADMIN_PASSWORD 로 로그인)
- 공개 화면은 별도로: `pnpm --filter @ppp/public-web dev` → http://localhost:5174/portfolio
- API 문서: http://localhost:3000/api/docs

데이터를 남기며 개발하려면 `pnpm db:seed` 후 `pnpm dev` (파일 DB `.data/pglite`).
**이 모드는 서버를 Ctrl+C 로 종료하세요.** 강제 종료하면 로컬 DB 파일이 손상될 수 있으며, 그때는 `pnpm db:reset` 으로 다시 만듭니다(로컬 전용, 운영 DB와 무관).

실제 PostgreSQL 을 쓰려면 `.env` 에 `DATABASE_URL=postgres://...` 를 넣습니다.

## 테스트

```bash
pnpm test        # 공용 규칙 15개 + API 58개 (메모리 DB로 실행)
pnpm typecheck
```

API 테스트에는 로그인·권한, 소유자 간 데이터 격리, 공개 범위(비공개 데이터가 공개 API에 나오지 않음), 업로드 파일 검증이 포함되어 있습니다.

## 배포 (Vercel)

`main` 브랜치에 푸시하면 Vercel 이 `pnpm vercel-build` 를 실행합니다.

1. 공용 패키지 빌드
2. **DB 마이그레이션 적용** (`DATABASE_URL` 이 있을 때) 및 최초 1회 소유자 계정 생성
3. API 를 서버리스 함수 하나로 번들 (`/api/*`)
4. 관리자·공개 화면 정적 빌드 (`/admin`, `/portfolio`), 보안 헤더 적용

### 환경 변수 (Vercel 프로젝트 설정)

| 이름 | 설명 |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL 연결 주소 (Neon 연동이 자동 등록) |
| `BLOB_READ_WRITE_TOKEN` | 스크린샷 저장소 토큰 (Vercel Blob 연동이 자동 등록) |
| `ADMIN_EMAIL` | 최초 소유자 계정 이메일 |
| `ADMIN_PASSWORD_HASH` | 최초 비밀번호의 scrypt 해시 (`pnpm --filter @ppp/api hash-password "<비밀번호>"`). 이미 계정이 있으면 사용하지 않음 |
| `ADMIN_DISPLAY_NAME` | 최초 표시 이름 |
| `SEED_SAMPLE_DATA` | 최초 계정 생성 시 예시 데이터 생성 여부 |
| `DB_POOL_MAX` | 함수당 DB 연결 수 (3) |
| `FUNCTION_REGION` | API 함수 리전 (`sin1`, DB와 같은 곳) |

## 운영 메모

- **비밀번호 변경**: 관리자 → 설정. 바꾸면 다른 기기의 로그인은 해제됩니다.
- **DB 구조 변경**: `apps/api/src/db/schema.ts` 수정 → `pnpm db:generate` → 생성된 `apps/api/drizzle/*.sql` 을 함께 커밋. 다음 배포 때 자동 적용됩니다.
- **백업/복구**: Neon 콘솔의 Branch/Restore(시점 복구)를 사용합니다. 스크린샷은 Vercel Blob 저장소 `portfolio-screenshots` 에 있습니다.
- **미리보기 배포 주의**: 현재 Preview 배포도 운영 DB를 사용합니다. `main` 외 브랜치를 푸시해 DB 구조를 바꾸는 실험을 할 때는 Neon 에서 별도 브랜치를 만들어 Preview 환경 변수에 연결하세요.

## 보안

- 세션: httpOnly·Secure·SameSite=Lax 쿠키, DB에는 토큰의 SHA-256 해시만 저장, 12시간 만료
- 비밀번호: scrypt 해시, 로그인 실패 5회/15분 제한, 계정 존재 여부가 드러나지 않는 응답
- CSRF: 상태 변경 요청은 같은 출처(Origin)만 허용
- 입력: 모든 입력을 서버에서 zod 로 검증, URL 은 http(s)·ssh 만 허용(`javascript:` 차단)
- 업로드: 파일 내용(매직 바이트)으로 PNG·JPG·WebP·GIF 만 허용, SVG 거부, 4MB 제한
- 화면: CSP·X-Frame-Options·nosniff 헤더, 관리자 화면 검색엔진 비노출, 마크다운은 HTML 을 실행하지 않음
- 변경 이력: 관리자의 등록·수정·삭제·게시·로그인을 감사 이력으로 기록

## 알려진 한계

- 로그인 실패 제한은 서버리스 인스턴스별 메모리 기준입니다. 강한 차단이 필요하면 Vercel Firewall 규칙을 추가하세요.
- GitHub 저장소 정보는 수동 등록입니다(설계서의 2·3단계 GitHub 자동 동기화는 미구현).
- 단일 소유자 운영 기준입니다. 공개 화면은 가장 먼저 만들어진 계정의 포트폴리오를 보여 줍니다(데이터는 소유자별로 격리되어 있음).
