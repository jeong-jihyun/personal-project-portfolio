/** 프로젝트 산출물 링크 (문서·데모·배포 등). 이미지는 스크린샷 영역에서 다룬다. */
import { useState, type FormEvent } from 'react';
import { ASSET_TYPE_LABEL, assetSchema, type AssetDto, type AssetType, type Visibility } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useToast } from './Toast';
import { ConfirmDialog, VisibilityBadge } from './ui';

const LINK_TYPES: AssetType[] = ['DOCUMENT', 'DEMO', 'DEPLOYMENT', 'OTHER'];

export function AssetLinksPanel({ projectId, assets, onChanged }: { projectId: string; assets: AssetDto[]; onChanged(): void }) {
  const toast = useToast();
  const links = assets.filter((a) => a.type !== 'IMAGE');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: 'DOCUMENT' as AssetType, title: '', url: '', visibility: 'PUBLIC' as Visibility });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<AssetDto | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...form, projectId };
    const parsed = assetSchema.safeParse(body);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      await api('/admin/assets', { method: 'POST', body: JSON.stringify(body) });
      toast('산출물 링크를 추가했습니다.');
      setForm({ ...form, title: '', url: '' });
      setErrors({});
      setAdding(false);
      onChanged();
    } catch (err) {
      toast(err instanceof ApiRequestError ? err.message : '추가하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a: AssetDto) => {
    try {
      await api(`/admin/assets/${a.id}`, { method: 'PATCH', body: JSON.stringify({ visibility: a.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' }) });
      onChanged();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '변경하지 못했습니다.', 'error');
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/admin/assets/${deleting.id}`, { method: 'DELETE' });
      toast('산출물 링크를 삭제했습니다.');
      setDeleting(null);
      onChanged();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '삭제하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>산출물 링크 ({links.length})</h2>
        {!adding && (
          <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
            ＋ 링크 추가
          </button>
        )}
      </div>

      {adding && (
        <form className="asset-form" onSubmit={onSubmit} noValidate>
          <select className="input" aria-label="종류" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AssetType })}>
            {LINK_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <input
            className="input"
            aria-label="제목"
            placeholder="제목 (예: 설계 문서)"
            value={form.title}
            maxLength={120}
            aria-invalid={!!errors.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
          <input
            className="input"
            aria-label="주소"
            placeholder="https://"
            inputMode="url"
            value={form.url}
            aria-invalid={!!errors.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <select className="input" aria-label="공개 여부" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as Visibility })}>
            <option value="PUBLIC">공개</option>
            <option value="PRIVATE">비공개</option>
          </select>
          {(errors.title || errors.url) && <span className="error">{errors.title || errors.url}</span>}
          <div className="row-actions">
            <button type="button" className="btn btn-tertiary btn-sm" onClick={() => setAdding(false)}>
              취소
            </button>
            <button className="btn btn-primary btn-sm" disabled={busy}>
              추가
            </button>
          </div>
        </form>
      )}

      {links.length === 0 && !adding ? (
        <p className="muted">문서, 데모 영상, 배포 주소 같은 링크를 추가할 수 있습니다.</p>
      ) : (
        <ul className="plain-list">
          {links.map((a) => (
            <li key={a.id}>
              <div className="badges">
                <span className="badge">{ASSET_TYPE_LABEL[a.type]}</span>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="break">
                  {a.title}
                </a>
                <VisibilityBadge visibility={a.visibility} />
              </div>
              <div className="row-actions">
                <button className="btn btn-tertiary btn-sm" onClick={() => toggle(a)}>
                  {a.visibility === 'PUBLIC' ? '비공개로' : '공개로'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeleting(a)} aria-label={`${a.title} 삭제`}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {deleting && (
        <ConfirmDialog title="링크를 삭제할까요?" confirmLabel="삭제" danger busy={busy} onConfirm={doDelete} onCancel={() => setDeleting(null)}>
          <p>
            <b>{deleting.title}</b> 링크를 삭제합니다.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
