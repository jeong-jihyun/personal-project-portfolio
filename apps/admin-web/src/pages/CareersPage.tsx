/** ADM-06 경력 및 키워드: 경력 관리, 키워드 정리(이름 변경·합치기·삭제) */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { careerSchema, type CareerDto, type SkillDto, type Visibility } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useToast } from '../components/Toast';
import { ConfirmDialog, ErrorState, Field, VisibilityBadge } from '../components/ui';

export function CareersPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-06 · PROFILE DATA</div>
          <h1>경력 및 키워드</h1>
          <p className="muted">공개 화면에 표시할 경력과, 프로젝트에 쓴 키워드를 정리합니다.</p>
        </div>
      </div>
      <CareersSection />
      <KeywordsSection />
    </>
  );
}

// ── 경력 ──────────────────────────────────────────
function CareersSection() {
  const toast = useToast();
  const [items, setItems] = useState<CareerDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CareerDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CareerDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api<{ items: CareerDto[] }>('/admin/careers')
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof ApiRequestError ? e.message : '불러오지 못했습니다.'));
  }, []);
  useEffect(load, [load]);

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/admin/careers/${deleting.id}`, { method: 'DELETE' });
      toast('경력을 삭제했습니다.');
      setDeleting(null);
      load();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '삭제하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="careers-title">
      <div className="panel-head">
        <h2 id="careers-title">경력 {items ? `(${items.length})` : ''}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
          ＋ 경력 추가
        </button>
      </div>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : items.length === 0 ? (
        <div className="state">등록된 경력이 없습니다.</div>
      ) : (
        <ul className="plain-list">
          {items.map((c) => (
            <li key={c.id} className="career-row">
              <div className="career-main">
                <div className="badges">
                  <b>{c.company}</b>
                  <span className="muted">{c.position}</span>
                  <VisibilityBadge visibility={c.visibility} />
                </div>
                <span className="caption">
                  {c.startDate} ~ {c.endDate ?? '재직 중'}
                </span>
                {c.description && <p className="prewrap caption">{c.description}</p>}
              </div>
              <div className="row-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(c)}>
                  수정
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeleting(c)} aria-label={`${c.company} 경력 삭제`}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CareerDialog
          career={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog title="경력을 삭제할까요?" confirmLabel="삭제" danger busy={busy} onConfirm={doDelete} onCancel={() => setDeleting(null)}>
          <p>
            <b>{deleting.company}</b> · {deleting.position} 경력을 삭제합니다. 되돌릴 수 없습니다.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function CareerDialog({ career, onClose, onSaved }: { career?: CareerDto; onClose(): void; onSaved(): void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    company: career?.company ?? '',
    position: career?.position ?? '',
    startDate: career?.startDate ?? '',
    endDate: career?.endDate ?? '',
    description: career?.description ?? '',
    visibility: (career?.visibility ?? 'PUBLIC') as Visibility,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => {
    setForm({ ...form, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: '' });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = careerSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      await api(career ? `/admin/careers/${career.id}` : '/admin/careers', { method: career ? 'PATCH' : 'POST', body: JSON.stringify(form) });
      toast(career ? '경력을 수정했습니다.' : '경력을 추가했습니다.');
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError && Array.isArray(err.body.details)) {
        const next: Record<string, string> = {};
        for (const d of err.body.details as { path: string; message: string }[]) next[d.path] ??= d.message;
        setErrors(next);
      }
      toast(err instanceof ApiRequestError ? err.message : '저장하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="career-title" onSubmit={onSubmit} noValidate>
        <div className="dialog-head">
          <h2 id="career-title">{career ? '경력 수정' : '경력 추가'}</h2>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="form-grid">
          <Field id="c-company" label="회사" required error={errors.company}>
            {(a) => <input {...a} autoFocus value={form.company} maxLength={120} onChange={(e) => set('company', e.target.value)} />}
          </Field>
          <Field id="c-position" label="직무" required error={errors.position}>
            {(a) => <input {...a} value={form.position} maxLength={120} placeholder="예: 백엔드 개발" onChange={(e) => set('position', e.target.value)} />}
          </Field>
          <Field id="c-startDate" label="시작일" required error={errors.startDate}>
            {(a) => <input {...a} type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />}
          </Field>
          <Field id="c-endDate" label="종료일" help="재직 중이면 비워 두세요." error={errors.endDate}>
            {(a) => <input {...a} type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />}
          </Field>
        </div>
        <Field id="c-description" label="주요 업무" error={errors.description}>
          {(a) => <textarea {...a} rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>
        <Field id="c-visibility" label="공개 여부" error={errors.visibility}>
          {(a) => (
            <select {...a} value={form.visibility} onChange={(e) => set('visibility', e.target.value)}>
              <option value="PUBLIC">공개 (공개 화면에 표시)</option>
              <option value="PRIVATE">비공개</option>
            </select>
          )}
        </Field>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </div>
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
