/** ADM-05 Git 저장소 관리: 내 전체 저장소, 프로젝트·공개 범위 필터, 등록·수정·대표 지정·삭제. */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GithubSyncResult, Paginated, ProjectSummaryDto, RepositoryWithProjectDto } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { RepositoryList } from '../components/RepositoryList';
import { useToast } from '../components/Toast';
import { ErrorState } from '../components/ui';

export function RepositoriesPage() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get('projectId') ?? '';
  const visibility = params.get('visibility') ?? '';
  const [items, setItems] = useState<RepositoryWithProjectDto[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummaryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (projectId) q.set('projectId', projectId);
    if (visibility) q.set('visibility', visibility);
    setError(null);
    setItems(null);
    api<{ items: RepositoryWithProjectDto[] }>(`/admin/repositories?${q}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : '불러오지 못했습니다.'));
  }, [projectId, visibility]);
  useEffect(load, [load]);

  const loadProjects = useCallback(() => {
    api<Paginated<ProjectSummaryDto>>('/admin/projects?pageSize=100&sort=title&order=asc')
      .then((r) => setProjects(r.items))
      .catch(() => setProjects([]));
  }, []);
  useEffect(loadProjects, [loadProjects]);

  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const r = await api<GithubSyncResult>('/admin/github/sync', { method: 'POST' });
      toast(`GitHub 동기화: 저장소 ${r.total}개${r.created ? ` · 새 프로젝트 ${r.created}개` : ''}${r.updated ? ` · 변경 ${r.updated}개` : ''}${r.errors.length ? ` · 실패 ${r.errors.length}개` : ''}`);
      load();
      loadProjects();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : 'GitHub 동기화에 실패했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  const primaryCount = items?.filter((r) => r.isPrimary).length ?? 0;
  const publicCount = items?.filter((r) => r.visibility === 'PUBLIC').length ?? 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-05 · GIT INTEGRATION</div>
          <h1>Git 저장소 관리</h1>
          <p className="muted">GitHub 저장소 1개 = 프로젝트 1개입니다. 동기화하면 새 저장소는 프로젝트로 만들어지고, 정보는 GitHub 값으로 맞춰집니다.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={runSync} disabled={syncing}>
            {syncing ? '동기화 중…' : '↻ GitHub 동기화'}
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="toolbar toolbar-2">
          <label className="sr-only" htmlFor="rp">
            프로젝트
          </label>
          <select id="rp" className="input" value={projectId} onChange={(e) => setFilter('projectId', e.target.value)}>
            <option value="">전체 프로젝트</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="rv">
            공개 범위
          </label>
          <select id="rv" className="input" value={visibility} onChange={(e) => setFilter('visibility', e.target.value)}>
            <option value="">공개·비공개 전체</option>
            <option value="PUBLIC">공개</option>
            <option value="PRIVATE">비공개</option>
          </select>
        </div>

        {items && (
          <p className="caption" style={{ marginBottom: 12 }}>
            저장소 {items.length}개 · 공개 {publicCount}개 · 대표 {primaryCount}개
          </p>
        )}

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !items ? (
          <div className="stack">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 96 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="state">
            <h3>{projectId || visibility ? '조건에 맞는 저장소가 없습니다' : '등록된 저장소가 없습니다'}</h3>
            <p>
              위의 <b>GitHub 동기화</b>를 눌러 저장소를 불러오세요.
            </p>
          </div>
        ) : (
          <RepositoryList items={items} showProject onChanged={load} />
        )}
      </section>

    </>
  );
}
