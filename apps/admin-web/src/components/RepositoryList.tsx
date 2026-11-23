/** 저장소 카드 목록 + 수정/대표 지정/삭제 동작 (상세 화면·Git 저장소 화면 공용). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { isWebUrl, REPOSITORY_PROVIDER_LABEL, type RepositoryDto, type RepositoryWithProjectDto } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { RepositoryDialog } from './RepositoryDialog';
import { useToast } from './Toast';
import { ConfirmDialog, VisibilityBadge } from './ui';

export function RepositoryList({
  items,
  showProject,
  onChanged,
}: {
  items: (RepositoryDto | RepositoryWithProjectDto)[];
  showProject?: boolean;
  onChanged(): void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<RepositoryDto | null>(null);
  const [deleting, setDeleting] = useState<RepositoryDto | null>(null);
  const [busy, setBusy] = useState(false);

  const makePrimary = async (r: RepositoryDto) => {
    try {
      await api(`/admin/repositories/${r.id}`, { method: 'PATCH', body: JSON.stringify({ isPrimary: true }) });
      toast(`'${r.name}'을(를) 대표 저장소로 지정했습니다.`);
      onChanged();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '변경하지 못했습니다.', 'error');
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/admin/repositories/${deleting.id}`, { method: 'DELETE' });
      toast('저장소가 삭제되었습니다.');
      setDeleting(null);
      onChanged();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '삭제하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ul className="repo-list">
        {items.map((r) => (
          <li key={r.id} className="repo">
            <div className="repo-head">
              <div className="badges">
                <b>{r.name}</b>
                {r.isPrimary && <span className="badge badge-featured">★ 대표</span>}
                <VisibilityBadge visibility={r.visibility} />
                <span className="caption">{REPOSITORY_PROVIDER_LABEL[r.provider]}</span>
              </div>
              <div className="repo-actions">
                {!r.isPrimary && (
                  <button className="btn btn-tertiary btn-sm" onClick={() => makePrimary(r)}>
                    대표로 지정
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)}>
                  수정
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setDeleting(r)} aria-label={`${r.name} 삭제`}>
                  삭제
                </button>
              </div>
            </div>
            {showProject && 'projectTitle' in r && (
              <Link to={`/projects/${r.projectId}`} className="caption">
                ▤ {r.projectTitle}
              </Link>
            )}
            {/* SSH 주소(git@host:...)는 브라우저 링크가 아니므로 텍스트로 표시한다. */}
            {isWebUrl(r.url) ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="break">
                {r.url}
              </a>
            ) : (
              <code className="break">{r.url}</code>
            )}
            <dl className="repo-meta">
              <div>
                <dt>브랜치</dt>
                <dd>
                  {r.defaultBranch ?? '-'}
                  {r.developmentBranch ? ` / ${r.developmentBranch}` : ''}
                </dd>
              </div>
              {r.readmeUrl && (
                <div>
                  <dt>README</dt>
                  <dd>
                    <a href={r.readmeUrl} target="_blank" rel="noopener noreferrer">
                      열기
                    </a>
                  </dd>
                </div>
              )}
              {r.deploymentUrl && (
                <div>
                  <dt>배포</dt>
                  <dd>
                    <a href={r.deploymentUrl} target="_blank" rel="noopener noreferrer" className="break">
                      {r.deploymentUrl}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </li>
        ))}
      </ul>

      {editing && (
        <RepositoryDialog
          repository={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="저장소를 삭제할까요?"
          confirmLabel="삭제"
          danger
          busy={busy}
          onConfirm={doDelete}
          onCancel={() => setDeleting(null)}
        >
          <p>
            <b>{deleting.name}</b> 저장소 연결을 삭제합니다. 실제 Git 저장소는 삭제되지 않습니다.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
