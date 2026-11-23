/** ADM-01 대시보드. 프로젝트 KPI는 6단계(프로젝트 API)에서 실제 값으로 바뀐다. */
import { useCallback, useEffect, useState } from 'react';
import type { ActivityDto } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useAuth } from '../auth';

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
const ROADMAP: { step: number; title: string; detail: string; done: boolean }[] = [
  { step: 1, title: '기반 구조', detail: '모노레포, 공용 검증 규칙, 디자인 토큰', done: true },
  { step: 2, title: '데이터베이스', detail: 'Neon PostgreSQL, 마이그레이션', done: true },
  { step: 3, title: 'API 기반', detail: '오류 형식, 보안 헤더, API 문서', done: true },
  { step: 4, title: '로그인·권한', detail: '세션, 로그인 시도 제한, 변경 이력', done: true },
  { step: 5, title: '관리자 화면 틀', detail: '로그인 화면, 메뉴, 대시보드', done: true },
  { step: 6, title: '프로젝트 관리', detail: '목록·검색·등록·수정·삭제', done: false },
  { step: 7, title: 'Git 저장소', detail: '여러 저장소, 대표 저장소, 공개 여부', done: false },
  { step: 8, title: '경력·기술·산출물', detail: '경력, 기술 스택, 산출물 링크', done: false },
  { step: 9, title: '공개 포트폴리오', detail: '게시 설정, 공개 화면', done: false },
  { step: 10, title: '마무리', detail: '보안 점검, 모바일, 문서', done: false },
];

export function DashboardPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setActivities(null);
    api<{ items: ActivityDto[] }>('/admin/activities?limit=6')
      .then((r) => setActivities(r.items))
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : '불러오지 못했습니다.'));
  }, []);
  useEffect(load, [load]);

  const doneCount = ROADMAP.filter((r) => r.done).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">OVERVIEW</div>
          <h1>대시보드</h1>
          <p className="muted">{user?.displayName}님, 프로젝트 현황과 포트폴리오 운영 상태를 확인하세요.</p>
        </div>
        <button className="btn btn-primary" disabled title="6단계에서 제공">
          ＋ 프로젝트 등록
        </button>
      </div>

      <div className="kpi-grid">
        {['전체 프로젝트', '진행 중', '완료', '공개 프로젝트'].map((label) => (
          <div className="card kpi" key={label}>
            <span className="kpi-label">{label}</span>
            <strong aria-label="아직 집계 전">—</strong>
            <span className="caption">6단계부터 표시</span>
          </div>
        ))}
      </div>

      <div className="two-col">
        <section className="panel" aria-labelledby="act-title">
          <div className="panel-head">
            <h2 id="act-title">최근 활동</h2>
            <button className="btn btn-tertiary btn-sm" onClick={load}>
              새로고침
            </button>
          </div>
          {error ? (
            <div className="state">
              <p>{error}</p>
              <button className="btn btn-secondary" onClick={load}>
                다시 시도
              </button>
            </div>
          ) : activities === null ? (
            <div className="stack">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 40 }} />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="state">아직 기록된 활동이 없습니다.</div>
          ) : (
            <ul className="activity-list">
              {activities.map((a) => (
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

        <section className="panel" aria-labelledby="road-title">
          <div className="panel-head">
            <h2 id="road-title">개발 진행 현황</h2>
            <span className="badge badge-completed">
              {doneCount} / {ROADMAP.length} 단계
            </span>
          </div>
          <div className="progress" aria-hidden="true">
            <div style={{ width: `${(doneCount / ROADMAP.length) * 100}%` }} />
          </div>
          <ol className="roadmap">
            {ROADMAP.map((r) => (
              <li key={r.step} className={r.done ? 'done' : ''}>
                <span className="roadmap-mark" aria-hidden="true">
                  {r.done ? '✓' : r.step}
                </span>
                <div>
                  <b>
                    {r.step}. {r.title}
                  </b>
                  <span className="caption">
                    {r.detail}
                    <span className="sr-only">{r.done ? ' (완료)' : ' (예정)'}</span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
