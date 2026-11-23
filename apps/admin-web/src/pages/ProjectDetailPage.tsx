/** ADM-04 프로젝트 상세: 개요, 내용, 연결 저장소, 산출물, 삭제(영향 안내). */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ProjectDeleteImpactDto, ProjectDetailDto } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { RepositoryDialog } from '../components/RepositoryDialog';
import { RepositoryList } from '../components/RepositoryList';
import { useToast } from '../components/Toast';
import { ConfirmDialog, ErrorState, formatPeriod, PublicationBadge, StatusBadge, VisibilityBadge } from '../components/ui';

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [project, setProject] = useState<ProjectDetailDto | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [impact, setImpact] = useState<ProjectDeleteImpactDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addingRepo, setAddingRepo] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api<ProjectDetailDto>(`/admin/projects/${id}`)
      .then(setProject)
      .catch((e) =>
        setError(e instanceof ApiRequestError ? { status: e.status, message: e.message } : { status: 0, message: '불러오지 못했습니다.' }),
      );
  }, [id]);
  useEffect(load, [load]);

  const askDelete = async () => {
    try {
      setImpact(await api<ProjectDeleteImpactDto>(`/admin/projects/${id}/delete-impact`));
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '삭제 정보를 불러오지 못했습니다.', 'error');
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api(`/admin/projects/${id}`, { method: 'DELETE' });
      toast('프로젝트가 삭제되었습니다.');
      navigate('/projects', { replace: true });
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '삭제하지 못했습니다.', 'error');
      setDeleting(false);
      setImpact(null);
    }
  };

  if (error) {
    return error.status === 404 ? (
      <div className="state">
        <h2>프로젝트를 찾을 수 없습니다</h2>
        <p>삭제되었거나 접근 권한이 없는 프로젝트입니다.</p>
        <Link to="/projects" className="btn btn-secondary">
          목록으로
        </Link>
      </div>
    ) : (
      <ErrorState message={error.message} onRetry={load} />
    );
  }
  if (!project) return <div className="skeleton" style={{ height: 360 }} aria-busy="true" />;

  const p = project;
  return (
    <>
      <nav className="breadcrumb" aria-label="위치">
        <Link to="/projects">프로젝트 관리</Link> <span aria-hidden="true">›</span> <span>{p.title}</span>
      </nav>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-04</div>
          <h1>{p.title}</h1>
          <div className="badges" style={{ marginTop: 8 }}>
            <StatusBadge status={p.status} />
            <VisibilityBadge visibility={p.visibility} />
            <PublicationBadge status={p.publicationStatus} />
          </div>
        </div>
        <div className="row-actions">
          <Link to={`/projects/${p.id}/edit`} className="btn btn-primary">
            수정
          </Link>
          <button className="btn btn-danger" onClick={askDelete}>
            삭제
          </button>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <section className="panel">
            <h2 className="section-title">개요</h2>
            <p>{p.summary || <span className="muted">요약이 없습니다.</span>}</p>
            <dl className="meta">
              <dt>기간</dt>
              <dd>{formatPeriod(p.startDate, p.endDate)}</dd>
              <dt>담당 역할</dt>
              <dd>{p.role || '-'}</dd>
              <dt>프로젝트 URL</dt>
              <dd>
                {p.projectUrl ? (
                  <a href={p.projectUrl} target="_blank" rel="noopener noreferrer" className="break">
                    {p.projectUrl} ↗
                  </a>
                ) : (
                  '-'
                )}
              </dd>
              <dt>키워드</dt>
              <dd>{p.skills.length ? p.skills.map((s) => <span key={s.id} className="tag">#{s.name}</span>) : '-'}</dd>
            </dl>
          </section>
          <section className="panel">
            <h2 className="section-title">문제 / 목표</h2>
            <p className="prewrap">{p.problem || '-'}</p>
            <h2 className="section-title">수행 내용</h2>
            <p className="prewrap">{p.description || '-'}</p>
            <h2 className="section-title">성과 및 결과</h2>
            <p className="prewrap">{p.outcome || '-'}</p>
          </section>
        </div>
        <div>
          <section className="panel">
            <div className="panel-head">
              <h2>연결 저장소 ({p.repositories.length})</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setAddingRepo(true)}>
                ＋ 저장소 추가
              </button>
            </div>
            {p.repositories.length === 0 ? (
              <p className="muted">연결된 저장소가 없습니다. 저장소 URL만 넣으면 이름은 자동으로 채워집니다.</p>
            ) : (
              <RepositoryList items={p.repositories} onChanged={load} />
            )}
          </section>
          <section className="panel">
            <div className="panel-head">
              <h2>산출물 ({p.assets.length})</h2>
              <span className="badge badge-planned">편집은 8단계</span>
            </div>
            {p.assets.length === 0 ? <p className="muted">등록된 산출물이 없습니다.</p> : null}
          </section>
          <p className="caption">
            등록 {new Date(p.createdAt).toLocaleString('ko-KR')} · 수정 {new Date(p.updatedAt).toLocaleString('ko-KR')}
          </p>
        </div>
      </div>

      {addingRepo && (
        <RepositoryDialog
          projectId={p.id}
          onClose={() => setAddingRepo(false)}
          onSaved={() => {
            setAddingRepo(false);
            load();
          }}
        />
      )}

      {impact && (
        <ConfirmDialog
          title="프로젝트를 삭제할까요?"
          confirmLabel="영구 삭제"
          danger
          busy={deleting}
          onConfirm={doDelete}
          onCancel={() => setImpact(null)}
        >
          <p>
            <b>{p.title}</b> 프로젝트를 삭제합니다. 되돌릴 수 없습니다.
          </p>
          <ul className="impact">
            <li>연결 저장소 {impact.repositories}개 함께 삭제</li>
            <li>산출물 {impact.assets}개 함께 삭제</li>
            <li>기술 연결 {impact.skills}개 해제 (기술 항목 자체는 유지)</li>
          </ul>
        </ConfirmDialog>
      )}
    </>
  );
}
