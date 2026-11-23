/**
 * ADM-02 프로젝트 목록: 검색, 상태·공개 필터, 정렬, 페이지네이션. 데스크톱은 표, 모바일은 카드.
 * 프로젝트 = GitHub 저장소. 직접 등록하지 않고, 목록을 열 때 GitHub와 동기화한다(10분에 한 번).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, type GithubSyncResult, type Paginated, type ProjectSummaryDto } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useToast } from '../components/Toast';
import { ErrorState, Pagination, StatusBadge } from '../components/ui';

const PAGE_SIZE = 10;
const SYNC_KEY = 'ppp.githubSyncedAt';
const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const SORTS = [
  { value: 'githubPushedAt:desc', label: '깃 최근 변경순' },
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
  const sort = params.get('sort') ?? 'githubPushedAt:desc';
  const page = Number(params.get('page') ?? 1) || 1;

  const [query, setQuery] = useState(q);
  const [data, setData] = useState<Paginated<ProjectSummaryDto> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SYNC_KEY);
    } catch {
      return null;
    }
  });
  const toast = useToast();

  /** 공개 화면 노출 스위치: 켜면 공개+게시, 끄면 비공개+게시 해제 (화면을 먼저 바꾸고 실패하면 되돌림) */
  const togglePublic = async (p: ProjectSummaryDto) => {
    const on = !(p.visibility === 'PUBLIC' && p.publicationStatus === 'PUBLISHED');
    const patch = on
      ? ({ visibility: 'PUBLIC', publicationStatus: 'PUBLISHED' } as const)
      : ({ visibility: 'PRIVATE', publicationStatus: 'DRAFT' } as const);
    const setRow = (v: Partial<ProjectSummaryDto>) =>
      setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === p.id ? { ...x, ...v } : x)) } : d));
    setRow(patch);
    setBusyIds((b) => new Set(b).add(p.id));
    try {
      await api(`/admin/projects/${p.id}/publication`, { method: 'PATCH', body: JSON.stringify(patch) });
      toast(on ? `'${p.title}' 공개 화면에 보입니다.` : `'${p.title}' 공개 화면에서 숨겼습니다.`);
    } catch (e) {
      setRow({ visibility: p.visibility, publicationStatus: p.publicationStatus });
      toast(e instanceof ApiRequestError ? e.message : '바꾸지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setBusyIds((b) => {
        const n = new Set(b);
        n.delete(p.id);
        return n;
      });
    }
  };

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

  /** GitHub 동기화: 새 저장소는 프로젝트로 만들고, 이름·설명·주소·최근 변경일을 맞춘다 */
  const sync = useCallback(
    async (manual: boolean) => {
      setSyncing(true);
      try {
        const r = await api<GithubSyncResult>('/admin/github/sync', { method: 'POST' });
        setSyncedAt(r.syncedAt);
        try {
          sessionStorage.setItem(SYNC_KEY, r.syncedAt);
        } catch {
          /* 저장 못 해도 동작에는 지장 없음 */
        }
        if (manual || r.created || r.updated || r.errors.length) {
          toast(
            `GitHub 동기화: 저장소 ${r.total}개${r.created ? ` · 새 프로젝트 ${r.created}개` : ''}${r.updated ? ` · 변경 ${r.updated}개` : ''}${
              r.errors.length ? ` · 실패 ${r.errors.length}개` : ''
            }`,
          );
        }
        if (r.created || r.updated) load();
      } catch (e) {
        if (manual) toast(e instanceof ApiRequestError ? e.message : 'GitHub 동기화에 실패했습니다.');
      } finally {
        setSyncing(false);
      }
    },
    [load, toast],
  );

  // 목록을 열 때 자동 동기화 (최근 10분 안에 했으면 건너뜀)
  useEffect(() => {
    const last = syncedAt ? Date.parse(syncedAt) : 0;
    if (Date.now() - last > SYNC_INTERVAL_MS) void sync(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <p className="muted">GitHub 저장소가 곧 프로젝트입니다. 이름·설명·주소는 GitHub에서 자동으로 맞춰집니다.</p>
        </div>
        <div className="sync-box">
          <button type="button" className="btn btn-secondary" onClick={() => sync(true)} disabled={syncing}>
            {syncing ? '동기화 중…' : '↻ GitHub 동기화'}
          </button>
          <span className="caption">{syncing ? 'GitHub 저장소를 확인하고 있습니다' : syncedAt ? `마지막 동기화 ${shortDate(syncedAt)}` : '아직 동기화 안 함'}</span>
        </div>
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
              <h3>프로젝트가 없습니다</h3>
              <p>GitHub 저장소를 불러와 프로젝트로 만듭니다.</p>
              <button type="button" className="btn btn-primary" onClick={() => sync(true)} disabled={syncing}>
                {syncing ? '동기화 중…' : '↻ GitHub 동기화'}
              </button>
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
                  <th scope="col">공개 화면</th>
                  <th scope="col">기간</th>
                  <th scope="col" className="num">저장소</th>
                  <th scope="col">깃 변경</th>
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
                      <PublicSwitch p={p} busy={busyIds.has(p.id)} onToggle={() => togglePublic(p)} />
                    </td>
                    <td data-label="기간" className="cell-period">
                      {shortPeriod(p.startDate, p.endDate)}
                    </td>
                    <td data-label="저장소" className="num">
                      {p.repositoryCount ? `${p.repositoryCount}개` : <span className="muted">—</span>}
                    </td>
                    <td data-label="깃 변경" className="cell-date" title={p.githubRepo ?? 'GitHub 연결 없음'}>
                      {p.githubPushedAt ? shortDate(p.githubPushedAt) : <span className="muted">—</span>}
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

/** 공개 화면 노출 스위치. 공개·게시 중 하나만 켜진 어중간한 상태는 '일부'로 알려 준다. */
function PublicSwitch({ p, busy, onToggle }: { p: ProjectSummaryDto; busy: boolean; onToggle(): void }) {
  const on = p.visibility === 'PUBLIC' && p.publicationStatus === 'PUBLISHED';
  const partial = !on && (p.visibility === 'PUBLIC' || p.publicationStatus === 'PUBLISHED');
  return (
    <label className={`pswitch${on ? ' pswitch-on' : ''}`} title={partial ? '공개 또는 게시 중 하나만 켜져 있어 공개 화면에는 보이지 않습니다. 켜면 둘 다 켜집니다.' : undefined}>
      <input type="checkbox" role="switch" checked={on} disabled={busy} onChange={onToggle} aria-label={`${p.title} 공개 화면 노출`} />
      <span className="pswitch-track" aria-hidden="true">
        <span className="pswitch-thumb" />
      </span>
      <span className="pswitch-text">{busy ? '저장 중' : on ? '공개' : partial ? '일부' : '비공개'}</span>
    </label>
  );
}
