/** ADM-01 대시보드: 프로젝트 KPI, 최근 수정 프로젝트, 최근 활동, 개발 진행 현황. */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardDto } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useAuth } from '../auth';
import { CURRENT_STEP } from '../components/Layout';
import { ErrorState, StatusBadge, VisibilityBadge } from '../components/ui';

const ACTION_LABEL: Record<string, string> = {
  LOGIN: '로그인',
  CREATE: '등록',
  UPDATE: '수정',
  DELETE: '삭제',
  PUBLISH: '게시',
  UNPUBLISH: '게시 해제',
  REORDER: '순서 변경',
};

/** 개발 진행 현황: 단계마다 갱신해 남은 작업을 숨기지 않는다. */
const ROADMAP: { step: number; title: string; detail: string }[] = [
  { step: 1, title: '기반 구조', detail: '모노레포, 공용 검증 규칙, 디자인 토큰' },
  { step: 2, title: '데이터베이스', detail: 'Neon PostgreSQL, 마이그레이션' },
  { step: 3, title: 'API 기반', detail: '오류 형식, 보안 헤더, API 문서' },
  { step: 4, title: '로그인·권한', detail: '세션, 로그인 시도 제한, 변경 이력' },
  { step: 5, title: '관리자 화면 틀', detail: '로그인 화면, 메뉴, 대시보드' },
  { step: 6, title: '프로젝트 관리', detail: '목록·검색·등록·수정·삭제, 대시보드 집계' },
  { step: 7, title: 'Git 저장소', detail: '여러 저장소 등록, 대표 저장소 1개, 저장소별 공개 여부' },
  { step: 8, title: '경력·기술·산출물', detail: '경력, 기술 스택, 산출물 링크' },
  { step: 9, title: '공개 포트폴리오', detail: '게시 설정, 공개 화면' },
  { step: 10, title: '마무리', detail: '보안 점검, 모바일, 문서' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setData(null);
    api<DashboardDto>('/admin/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : '불러오지 못했습니다.'));
  }, []);
  useEffect(load, [load]);

  const kpis = data
    ? [
        { label: '전체 프로젝트', value: data.totalProjects, note: '등록된 프로젝트', to: '/projects' },
        { label: '진행 중', value: data.byStatus.IN_PROGRESS, note: '현재 작업', to: '/projects?status=IN_PROGRESS' },
        { label: '완료', value: data.byStatus.COMPLETED, note: '완료 프로젝트', to: '/projects?status=COMPLETED' },
        { label: '공개 게시', value: data.publishedProjects, note: '외부에 노출 중', to: '/projects?visibility=PUBLIC' },
      ]
    : null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-01 · OVERVIEW</div>
          <h1>대시보드</h1>
          <p className="muted">{user?.displayName}님, 프로젝트 현황과 포트폴리오 운영 상태를 확인하세요.</p>
        </div>
        <Link to="/projects/new" className="btn btn-primary">
          ＋ 프로젝트 등록
        </Link>
      </div>

      {error ? (
        <section className="panel">
          <ErrorState message={error} onRetry={load} />
        </section>
      ) : (
        <>
          <div className="kpi-grid">
            {kpis
              ? kpis.map((k) => (
                  <Link className="card kpi" key={k.label} to={k.to}>
                    <span className="kpi-label">{k.label}</span>
                    <strong>{k.value}</strong>
                    <span className="caption">{k.note}</span>
                  </Link>
                ))
              : [0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 104 }} />)}
          </div>

          <div className="two-col">
            <section className="panel" aria-labelledby="recent-title">
              <div className="panel-head">
                <h2 id="recent-title">최근 수정한 프로젝트</h2>
                <Link to="/projects" className="btn btn-tertiary btn-sm">
                  전체 보기
                </Link>
              </div>
              {!data ? (
                <div className="skeleton" style={{ height: 160 }} />
              ) : data.recentProjects.length === 0 ? (
                <div className="state">
                  아직 프로젝트가 없습니다. <Link to="/projects/new">첫 프로젝트 등록</Link>
                </div>
              ) : (
                <ul className="plain-list">
                  {data.recentProjects.map((p) => (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}`} className="row-title">
                        {p.title}
                      </Link>
                      <div className="badges">
                        <StatusBadge status={p.status} />
                        <VisibilityBadge visibility={p.visibility} />
                        <span className="caption">저장소 {p.repositoryCount}개</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel" aria-labelledby="act-title">
              <div className="panel-head">
                <h2 id="act-title">최근 활동</h2>
                <button className="btn btn-tertiary btn-sm" onClick={load}>
                  새로고침
                </button>
              </div>
              {!data ? (
                <div className="skeleton" style={{ height: 160 }} />
              ) : data.recentActivities.length === 0 ? (
                <div className="state">아직 기록된 활동이 없습니다.</div>
              ) : (
                <ul className="activity-list">
                  {data.recentActivities.map((a) => (
                    <li key={a.id}>
                      <span className="badge badge-planned">{ACTION_LABEL[a.action] ?? a.action}</span>
                      <span className="activity-text">{a.summary ?? a.entityType}</span>
                      <time className="caption" dateTime={a.createdAt}>
                        {new Date(a.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="two-col">
            <section className="panel" aria-labelledby="pub-title">
              <div className="panel-head">
                <h2 id="pub-title">포트폴리오 게시 상태</h2>
                {data && <span className="badge badge-published">{data.publishedProjects}개 게시</span>}
              </div>
              <p className="muted">
                공개 화면에는 <b>공개</b>이면서 <b>게시</b>된 프로젝트만 표시됩니다. 저장소 공개 여부는 프로젝트와 별도로 관리합니다.
              </p>
              {data && (
                <p className="caption">
                  저장소 {data.totalRepositories}개 중 공개 {data.publicRepositories}개 · 프로필 {data.profilePublished ? '게시 중' : '비게시'}
                </p>
              )}
              <p className="caption">게시 설정과 공개 화면 미리보기는 9단계에서 제공합니다.</p>
            </section>

            <section className="panel" aria-labelledby="road-title">
              <div className="panel-head">
                <h2 id="road-title">개발 진행 현황</h2>
                <span className="badge badge-completed">
                  {CURRENT_STEP} / {ROADMAP.length} 단계
                </span>
              </div>
              <div className="progress" aria-hidden="true">
                <div style={{ width: `${(CURRENT_STEP / ROADMAP.length) * 100}%` }} />
              </div>
              <ol className="roadmap">
                {ROADMAP.map((r) => {
                  const done = r.step <= CURRENT_STEP;
                  return (
                    <li key={r.step} className={done ? 'done' : ''}>
                      <span className="roadmap-mark" aria-hidden="true">
                        {done ? '✓' : r.step}
                      </span>
                      <div>
                        <b>
                          {r.step}. {r.title}
                        </b>
                        <span className="caption">
                          {r.detail}
                          <span className="sr-only">{done ? ' (완료)' : ' (예정)'}</span>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        </>
      )}
    </>
  );
}
