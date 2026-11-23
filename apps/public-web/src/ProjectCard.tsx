import { Link } from 'react-router-dom';
import { PROJECT_STATUS_LABEL, type PublicProjectSummaryDto } from '@ppp/shared';
import { period } from './api';

/** 갤러리형 프로젝트 카드. onKeyword 가 있으면 카드 안 태그를 누를 때 같은 화면에서 거른다. */
export function ProjectCard({ p, onKeyword }: { p: PublicProjectSummaryDto; onKeyword?: (k: string) => void }) {
  const when = period(p.startDate, p.endDate);
  return (
    <article className="pcard">
      <Link to={`/projects/${p.slug}`} className="pcard-media" tabIndex={-1} aria-hidden="true">
        {p.coverImageUrl ? <img src={p.coverImageUrl} alt="" loading="lazy" /> : <span className="pcard-placeholder">{p.title.slice(0, 1)}</span>}
        <span className={`pcard-status status-${p.status.toLowerCase()}`}>{PROJECT_STATUS_LABEL[p.status]}</span>
      </Link>
      <div className="pcard-body">
        <h3>
          <Link to={`/projects/${p.slug}`}>{p.title}</Link>
        </h3>
        {when && <div className="pcard-meta">{when}</div>}
        {p.summary && <p className="pcard-summary">{p.summary}</p>}
        {p.skills.length > 0 && (
          <p className="kw-row">
            {p.skills.slice(0, 4).map((s) =>
              onKeyword ? (
                <button key={s} type="button" className="kw kw-sm" onClick={() => onKeyword(s)}>
                  #{s}
                </button>
              ) : (
                <Link key={s} to={`/projects?keyword=${encodeURIComponent(s)}`} className="kw kw-sm">
                  #{s}
                </Link>
              ),
            )}
          </p>
        )}
      </div>
    </article>
  );
}
