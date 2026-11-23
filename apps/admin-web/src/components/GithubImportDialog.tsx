/** GitHub 가져오기 대화상자: 내 GitHub 저장소(공개+비공개)를 골라 한 번에 등록한다. */
import { useEffect, useMemo, useState } from 'react';
import type { GithubImportResult, GithubReposResponse, ProjectSummaryDto } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useToast } from './Toast';

const NEW = '';
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

export function GithubImportDialog(props: { projects: Pick<ProjectSummaryDto, 'id' | 'title'>[]; onClose(): void; onDone(): void }) {
  const toast = useToast();
  const [data, setData] = useState<GithubReposResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'new' | 'all'>('new');
  const [picked, setPicked] = useState<Map<string, string>>(new Map()); // fullName → projectId('' = 새 프로젝트)

  useEffect(() => {
    api<GithubReposResponse>('/admin/github/repos')
      .then((d) => {
        setData(d);
        // 처음 열면 미등록 저장소를 모두 선택하고, 이름이 같은 기존 프로젝트가 있으면 거기에 붙이도록 미리 골라 둔다
        const byKey = new Map(props.projects.map((p) => [key(p.title), p.id]));
        setPicked(new Map(d.items.filter((r) => !r.registeredProject).map((r) => [r.fullName, byKey.get(key(r.name)) ?? NEW])));
      })
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : 'GitHub 목록을 불러오지 못했습니다.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, props]);

  const items = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (r) => (scope === 'all' || !r.registeredProject) && (!k || r.name.toLowerCase().includes(k) || (r.description ?? '').toLowerCase().includes(k)),
    );
  }, [data, q, scope]);

  const selectable = items.filter((r) => !r.registeredProject);
  const allOn = selectable.length > 0 && selectable.every((r) => picked.has(r.fullName));
  const total = data?.items.length ?? 0;
  const registered = data?.items.filter((r) => r.registeredProject).length ?? 0;
  const privateCount = data?.items.filter((r) => r.private).length ?? 0;

  const toggle = (name: string, on: boolean) =>
    setPicked((m) => {
      const n = new Map(m);
      if (on) n.set(name, n.get(name) ?? NEW);
      else n.delete(name);
      return n;
    });
  const toggleAll = () =>
    setPicked((m) => {
      const n = new Map(m);
      for (const r of selectable) allOn ? n.delete(r.fullName) : n.set(r.fullName, n.get(r.fullName) ?? NEW);
      return n;
    });

  const run = async () => {
    setBusy(true);
    try {
      const res = await api<GithubImportResult>('/admin/github/import', {
        method: 'POST',
        body: JSON.stringify({ items: [...picked].map(([fullName, projectId]) => ({ fullName, projectId: projectId || null })) }),
      });
      toast(
        `저장소 ${res.created}개 등록${res.newProjects ? ` (새 프로젝트 ${res.newProjects}개)` : ''}${res.skipped ? ` · 이미 있음 ${res.skipped}개` : ''}${
          res.errors.length ? ` · 실패 ${res.errors.length}개` : ''
        }`,
      );
      if (res.errors.length) setError(res.errors.map((e) => `${e.fullName}: ${e.message}`).join('\n'));
      else props.onDone();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : '등록하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && props.onClose()}>
      <div className="dialog dialog-wide gh-dialog" role="dialog" aria-modal="true" aria-labelledby="gh-title">
        <div className="dialog-head">
          <h2 id="gh-title">GitHub에서 가져오기</h2>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={props.onClose} disabled={busy}>
            닫기
          </button>
        </div>

        {error && <p className="gh-error prewrap" role="alert">{error}</p>}

        {!data && !error ? (
          <div className="stack" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 44 }} />
            ))}
          </div>
        ) : data ? (
          <>
            <p className="caption">
              <b>@{data.login}</b> · 전체 {total}개 (비공개 {privateCount}개) · 이미 등록 {registered}개
              {!data.includesPrivate && ' · 토큰이 없어 공개 저장소만 보입니다'}
            </p>
            <p className="help">프로젝트를 고르지 않으면 저장소 이름으로 새 프로젝트를 <b>비공개·비게시</b>로 만들어 붙입니다. 공개 화면에는 나오지 않습니다.</p>

            <div className="gh-tools">
              <input className="input" placeholder="저장소 이름·설명 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="저장소 검색" />
              <select className="input" value={scope} onChange={(e) => setScope(e.target.value as 'new' | 'all')} aria-label="보기 범위">
                <option value="new">미등록만</option>
                <option value="all">전체 보기</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={toggleAll} disabled={selectable.length === 0}>
                {allOn ? '선택 해제' : '모두 선택'}
              </button>
            </div>

            <ul className="gh-list">
              {items.length === 0 && <li className="muted gh-empty">{scope === 'new' ? '새로 가져올 저장소가 없습니다. 모두 등록되어 있습니다.' : '검색 결과가 없습니다.'}</li>}
              {items.map((r) => {
                const on = picked.has(r.fullName);
                return (
                  <li key={r.fullName} className={r.registeredProject ? 'gh-done' : on ? 'gh-on' : ''}>
                    <label className="gh-check">
                      <input type="checkbox" checked={on} disabled={!!r.registeredProject} onChange={(e) => toggle(r.fullName, e.target.checked)} />
                      <span className="gh-name">
                        <b>{r.name}</b>
                        <span className={`tag gh-vis${r.private ? '' : ' gh-pub'}`}>{r.private ? '비공개' : '공개'}</span>
                        {r.archived && <span className="tag">보관</span>}
                        {r.fork && <span className="tag">포크</span>}
                        <span className="caption gh-desc">{[r.language, r.description].filter(Boolean).join(' · ') || '설명 없음'}</span>
                      </span>
                    </label>
                    {r.registeredProject ? (
                      <span className="caption gh-linked">✓ {r.registeredProject.title}</span>
                    ) : (
                      <select
                        className="input gh-project"
                        value={picked.get(r.fullName) ?? NEW}
                        disabled={!on}
                        aria-label={`${r.name} 연결할 프로젝트`}
                        onChange={(e) => setPicked((m) => new Map(m).set(r.fullName, e.target.value))}
                      >
                        <option value={NEW}>＋ 새 프로젝트로</option>
                        {props.projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={props.onClose} disabled={busy}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy || picked.size === 0}>
            {busy ? '등록 중…' : `선택한 ${picked.size}개 등록`}
          </button>
        </div>
      </div>
    </div>
  );
}
