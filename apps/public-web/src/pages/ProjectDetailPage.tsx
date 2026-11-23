/** PUB-03 프로젝트 상세: 스크린샷, 문제/목표 → 담당 역할 → 수행 내용 → 결과, 키워드, 공개 저장소·서비스 링크 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ASSET_TYPE_LABEL, PROJECT_STATUS_LABEL, REPOSITORY_PROVIDER_LABEL, isWebUrl, type PublicAssetDto } from '@ppp/shared';
import { NotFoundError, period, publicApi, useLoad } from '../api';
import { NotFound } from '../App';

export function ProjectDetailPage() {
  const { slug = '' } = useParams();
  const { data: p, error, loading } = useLoad(() => publicApi.project(slug), [slug]);
  const [view, setView] = useState<number | null>(null);

  useEffect(() => {
    if (p) document.title = `${p.title} · 포트폴리오`;
  }, [p]);

  if (error instanceof NotFoundError) return <NotFound />;
  if (error) return <p className="pub-section first muted">프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>;
  if (loading || !p) {
    return (
      <div className="pub-section first">
        <div className="skeleton" style={{ height: 48, maxWidth: 480 }} />
        <div className="skeleton" style={{ height: 360, marginTop: 24 }} />
      </div>
    );
  }

  const images = p.assets.filter((a) => a.type === 'IMAGE');
  const links = p.assets.filter((a) => a.type !== 'IMAGE');
  const sections: [string, string | null][] = [
    ['문제 / 목표', p.problem],
    ['담당 역할', p.role],
    ['수행 내용', p.description],
    ['결과', p.outcome],
  ];

  return (
    <article className="pub-section first detail">
      <Link to="/projects" className="back">
        ← 프로젝트 목록
      </Link>
      <header className="detail-head">
        <div className="pcard-meta">
          <span>{PROJECT_STATUS_LABEL[p.status]}</span>
          {period(p.startDate, p.endDate) && <span>{period(p.startDate, p.endDate)}</span>}
        </div>
        <h1 className="page-title">{p.title}</h1>
        {p.summary && <p className="hero-lead">{p.summary}</p>}
        <div className="detail-actions">
          {p.projectUrl && isWebUrl(p.projectUrl) && (
            <a href={p.projectUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              서비스 바로가기 ↗
            </a>
          )}
          {p.repositories
            .filter((r) => r.isPrimary)
            .map((r) => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                {REPOSITORY_PROVIDER_LABEL[r.provider]} 저장소 ↗
              </a>
            ))}
        </div>
        {p.skills.length > 0 && (
          <p className="kw-row">
            {p.skills.map((s) => (
              <Link key={s} to={`/projects?keyword=${encodeURIComponent(s)}`} className="kw">
                #{s}
              </Link>
            ))}
          </p>
        )}
      </header>

      {images.length > 0 && (
        <section className="gallery" aria-label="스크린샷">
          <button type="button" className="gallery-main" onClick={() => setView(0)} aria-label={`${images[0]!.title} 크게 보기`}>
            <img src={images[0]!.url} alt={images[0]!.title} />
          </button>
          {images.length > 1 && (
            <ul className="gallery-thumbs">
              {images.slice(1).map((img, i) => (
                <li key={img.url}>
                  <button type="button" onClick={() => setView(i + 1)} aria-label={`${img.title} 크게 보기`}>
                    <img src={img.url} alt={img.title} loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="story">
        {sections
          .filter(([, v]) => v)
          .map(([label, v]) => (
            <section key={label}>
              <h2>{label}</h2>
              <p className="prewrap">{v}</p>
            </section>
          ))}
      </div>

      {(p.repositories.length > 0 || links.length > 0) && (
        <section className="story-links">
          <h2>저장소 · 자료</h2>
          <ul>
            {p.repositories.map((r) => (
              <li key={r.url}>
                {isWebUrl(r.url) ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    {r.name}
                  </a>
                ) : (
                  <span>{r.name}</span>
                )}
                <span className="muted"> · {REPOSITORY_PROVIDER_LABEL[r.provider]}{r.isPrimary ? ' · 대표' : ''}</span>
                {r.deploymentUrl && (
                  <a href={r.deploymentUrl} target="_blank" rel="noopener noreferrer" className="small-link">
                    배포 ↗
                  </a>
                )}
                {r.readmeUrl && (
                  <a href={r.readmeUrl} target="_blank" rel="noopener noreferrer" className="small-link">
                    README ↗
                  </a>
                )}
              </li>
            ))}
            {links.map((a) => (
              <li key={a.url}>
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.title}
                </a>
                <span className="muted"> · {ASSET_TYPE_LABEL[a.type]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view !== null && <Viewer images={images} index={view} onIndex={setView} onClose={() => setView(null)} />}
    </article>
  );
}

function Viewer({ images, index, onIndex, onClose }: { images: PublicAssetDto[]; index: number; onIndex(i: number): void; onClose(): void }) {
  const img = images[index]!;
  const prev = () => onIndex((index - 1 + images.length) % images.length);
  const next = () => onIndex((index + 1) % images.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={img.title} onClick={onClose}>
      <img src={img.url} alt={img.title} onClick={(e) => e.stopPropagation()} />
      <div className="viewer-bar" onClick={(e) => e.stopPropagation()}>
        {images.length > 1 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={prev} aria-label="이전 이미지">
            ‹
          </button>
        )}
        <span>
          {img.title} · {index + 1}/{images.length}
        </span>
        {images.length > 1 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={next} aria-label="다음 이미지">
            ›
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} autoFocus>
          닫기
        </button>
      </div>
    </div>
  );
}
