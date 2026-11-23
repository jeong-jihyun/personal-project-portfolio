import { Link } from 'react-router-dom';
import { PROJECT_STATUS_LABEL, type PublicProjectSummaryDto } from '@ppp/shared';
import { period } from './api';

export function ProjectCard({ p, large }: { p: PublicProjectSummaryDto; large?: boolean }) {
  return (
    <article className={`pcard${large ? ' pcard-large' : ''}`}>
      <Link to={`/projects/${p.slug}`} className="pcard-media" tabIndex={-1} aria-hidden="true">
        {p.coverImageUrl ? <img src={p.coverImageUrl} alt="" loading="lazy" /> : <span className="pcard-placeholder">{p.title.slice(0, 1)}</span>}
      </Link>
      <div className="pcard-body">
        <div className="pcard-meta">
          <span>{PROJECT_STATUS_LABEL[p.status]}</span>
          {period(p.startDate, p.endDate) && <span>{period(p.startDate, p.endDate)}</span>}
        </div>
        <h3>
          <Link to={`/projects/${p.slug}`}>{p.title}</Link>
        </h3>
        {p.summary && <p className="pcard-summary">{p.summary}</p>}
        {p.skills.length > 0 && (
          <p className="kw-row">
            {p.skills.slice(0, 6).map((s) => (
              <Link key={s} to={`/projects?keyword=${encodeURIComponent(s)}`} className="kw">
                #{s}
              </Link>
            ))}
          </p>
        )}
      </div>
    </article>
  );
}
