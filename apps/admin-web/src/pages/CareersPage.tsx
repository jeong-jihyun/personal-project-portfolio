/** ADM-06 경력 및 키워드: 경력(마크다운 한 번에 작성), 키워드 정리(이름 변경·합치기·삭제) */
import { useCallback, useEffect, useState } from 'react';
import type { SkillDto } from '@ppp/shared';
import { CareerMarkdownEditor } from '../components/CareerMarkdownEditor';
import { api, ApiRequestError } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ui';

export function CareersPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-06 · PROFILE DATA</div>
          <h1>경력 및 키워드</h1>
          <p className="muted">경력은 한 번에 붙여넣어 작성하고, 프로젝트에 쓴 키워드는 아래에서 정리합니다.</p>
        </div>
      </div>
      <CareerMarkdownEditor />
      <KeywordsSection />
    </>
  );
}

// ── 키워드 정리 ───────────────────────────────────
function KeywordsSection() {
  const toast = useToast();
  const [items, setItems] = useState<SkillDto[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deleting, setDeleting] = useState<SkillDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ items: SkillDto[] }>('/admin/skills')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  const rename = async (s: SkillDto) => {
    const name = draft.trim().replace(/^#+/, '');
    if (!name || name === s.name) return setEditingId(null);
    const merging = items?.find((x) => x.id !== s.id && x.name.toLowerCase() === name.toLowerCase());
    try {
      const r = await api<{ merged: boolean }>(`/admin/skills/${s.id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      toast(r.merged ? `#${s.name} 을(를) #${merging?.name ?? name} 에 합쳤습니다.` : `#${name} 으로 바꿨습니다.`);
      setEditingId(null);
      load();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '변경하지 못했습니다.', 'error');
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/admin/skills/${deleting.id}`, { method: 'DELETE' });
      toast(`#${deleting.name} 을(를) 삭제했습니다.`);
      setDeleting(null);
      load();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '삭제하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="kw-title">
      <div className="panel-head">
        <h2 id="kw-title">키워드 {items ? `(${items.length})` : ''}</h2>
        <span className="caption">키워드는 프로젝트 등록·수정에서 추가합니다</span>
      </div>
      <p className="caption" style={{ marginBottom: 12 }}>
        이름을 이미 있는 키워드로 바꾸면 하나로 합쳐집니다. (예: #reactjs → #React)
      </p>
      {!items ? (
        <div className="skeleton" style={{ height: 80 }} />
      ) : items.length === 0 ? (
        <div className="state">아직 키워드가 없습니다.</div>
      ) : (
        <ul className="kw-manage">
          {items.map((s) => (
            <li key={s.id}>
              {editingId === s.id ? (
                <form
                  className="kw-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rename(s);
                  }}
                >
                  <input
                    className="input"
                    autoFocus
                    aria-label={`${s.name} 새 이름`}
                    value={draft}
                    maxLength={41}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setEditingId(null)}
                  />
                  <button className="btn btn-primary btn-sm">저장</button>
                  <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setEditingId(null)}>
                    취소
                  </button>
                </form>
              ) : (
                <>
                  <span className="keyword">#{s.name}</span>
                  <span className="caption">프로젝트 {s.projectCount ?? 0}개</span>
                  <span className="kw-actions">
                    <button
                      className="btn btn-tertiary btn-sm"
                      onClick={() => {
                        setEditingId(s.id);
                        setDraft(s.name);
                      }}
                    >
                      이름 변경
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleting(s)} aria-label={`${s.name} 키워드 삭제`}>
                      삭제
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {deleting && (
        <ConfirmDialog title="키워드를 삭제할까요?" confirmLabel="삭제" danger busy={busy} onConfirm={doDelete} onCancel={() => setDeleting(null)}>
          <p>
            <b>#{deleting.name}</b> 을(를) 삭제합니다. 연결된 프로젝트 {deleting.projectCount ?? 0}개에서도 빠집니다.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
