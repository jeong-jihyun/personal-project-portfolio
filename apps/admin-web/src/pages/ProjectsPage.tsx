/** ADM-02 프로젝트 목록: 검색, 상태·공개 필터, 정렬, 페이지네이션. 데스크톱은 표, 모바일은 카드. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, type Paginated, type ProjectSummaryDto } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { ErrorState, Pagination, PublicationBadge, StatusBadge, VisibilityBadge } from '../components/ui';

const PAGE_SIZE = 10;
const SORTS = [
  { value: 'updatedAt:desc', label: '최근 수정순' },
  { value: 'createdAt:desc', label: '최근 등록순' },
  { value: 'title:asc', label: '이름순' },
  { value: 'startDate:desc', label: '시작일 최신순' },
];

export function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const visibility = params.get('visibility') ?? '';
  const sort = params.get('sort') ?? 'updatedAt:desc';
  const page = Number(params.get('page') ?? 1) || 1;

  const [query, setQuery] = useState(q);
  const [data, setData] = useState<Paginated<ProjectSummaryDto> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const load = useCallback(() => {
    const [sortKey, order] = sort.split(':');
    const search = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort: sortKey!, order: order! });
    if (q) search.set('q', q);
    if (status) search.set('status', status);
    if (visibility) search.set('visibility', visibility);
    setError(null);
    setData(null);
    api<Paginated<ProjectSummaryDto>>(`/admin/projects?${search}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : '목록을 불러오지 못했습니다.'));
  }, [q, status, visibility, sort, page]);
  useEffect(load, [load]);

  // 검색어 입력은 잠시 멈췄을 때 반영
  useEffect(() => {
    if (query === q) return;
    const t = setTimeout(() => update({ q: query.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const filtered = !!(q || status || visibility);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-02 · MANAGEMENT</div>
          <h1>프로젝트 관리</h1>
          <p className="muted">프로젝트 정보와 공개 상태를 관리합니다.</p>
        </div>
        <Link to="/projects/new" className="btn btn-primary">
          ＋ 프로젝트 등록
        </Link>
      </div>

      <section className="panel">
        <div className="toolbar" role="search">
          <label className="sr-only" htmlFor="q">
            프로젝트 검색
          </label>
          <input id="q" className="input" placeholder="프로젝트 이름, 요약 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="sr-only" htmlFor="status">
            상태
          </label>
          <select id="status" className="input" value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">전체 상태</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="visibility">
            공개 여부
          </label>
          <select id="visibility" className="input" value={visibility} onChange={(e) => update({ visibility: e.target.value })}>
            <option value="">공개·비공개 전체</option>
            <option value="PUBLIC">공개</option>
            <option value="PRIVATE">비공개</option>
          </select>
          <label className="sr-only" htmlFor="sort">
            정렬
          </label>
          <select id="sort" className="input" value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !data ? (
          <div className="stack" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 56 }} />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          filtered ? (
            <div className="state">
              <h3>검색 결과가 없습니다</h3>
              <p>검색어나 필터를 바꿔 보세요.</p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQuery('');
                  setParams({}, { replace: true });
                }}
              >
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="state">
              <h3>등록된 프로젝트가 없습니다</h3>
              <p>첫 프로젝트를 등록해 보세요.</p>
              <Link to="/projects/new" className="btn btn-primary">
                ＋ 프로젝트 등록
              </Link>
            </div>
          )
        ) : (
          <>
            <p className="list-count caption">
              총 <b>{data.total}</b>개{filtered ? ' (검색 결과)' : ''}
            </p>
            <table className="table ptable">
              <colgroup>
                <col />
                <col style={{ width: 96 }} />
                <col style={{ width: 132 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 72 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 64 }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">프로젝트</th>
                  <th scope="col">상태</th>
                  <th scope="col">공개 · 게시</th>
                  <th scope="col">기간</th>
                  <th scope="col" className="num">저장소</th>
                  <th scope="col">수정일</th>
                  <th scope="col">
                    <span className="sr-only">관리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td data-label="프로젝트" className="cell-project-td">
                      <div className="cell-project">
                      <Link to={`/projects/${p.id}`} className="row-thumb" aria-hidden="true" tabIndex={-1}>
                        {p.coverImageUrl ? <img src={p.coverImageUrl} alt="" loading="lazy" /> : <span>{p.title.slice(0, 1)}</span>}
                      </Link>
                      <div className="row-main">
                        <Link to={`/projects/${p.id}`} className="row-title" title={p.title}>
                          {p.title}
                        </Link>
                        {p.summary && (
                          <span className="row-summary" title={p.summary}>
                            {p.summary}
                          </span>
                        )}
                        {p.skills.length > 0 && (
                          <span className="row-tags">
                            {p.skills.slice(0, 3).map((s) => (
                              <span key={s.id} className="rtag">
                                #{s.name}
                              </span>
                            ))}
                            {p.skills.length > 3 && <span className="rtag rtag-more">+{p.skills.length - 3}</span>}
                          </span>
                        )}
                      </div>
                      </div>
                    </td>
                    <td data-label="상태">
                      <StatusBadge status={p.status} />
                    </td>
                    <td data-label="공개">
                      <div className="badges">
                        <VisibilityBadge visibility={p.visibility} />
                        <PublicationBadge status={p.publicationStatus} />
                      </div>
                    </td>
                    <td data-label="기간" className="cell-period">
                      {shortPeriod(p.startDate, p.endDate)}
                    </td>
                    <td data-label="저장소" className="num">
                      {p.repositoryCount ? `${p.repositoryCount}개` : <span className="muted">—</span>}
                    </td>
                    <td data-label="수정일" className="cell-date">
                      {shortDate(p.updatedAt)}
                    </td>
                    <td className="cell-actions">
                      <Link to={`/projects/${p.id}/edit`} className="btn btn-tertiary btn-sm" aria-label={`${p.title} 수정`}>
                        수정
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </section>
    </>
  );
}

/** 2026-07-01 → 2026.07 (목록용 짧은 표기) */
function ym(d: string): string {
  return d.slice(0, 7).replace('-', '.');
}
function shortPeriod(start: string | null, end: string | null) {
  if (!start && !end) return <span className="muted">기간 미정</span>;
  return (
    <>
      {start ? ym(start) : '?'} ~ {end ? ym(end) : <span className="ongoing">진행 중</span>}
    </>
  );
}
function shortDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  if (d.toDateString() === today.toDateString()) return `오늘 ${p(d.getHours())}:${p(d.getMinutes())}`;
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
