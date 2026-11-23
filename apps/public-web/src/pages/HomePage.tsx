/** PUB-01 홈: 소개, 대표 프로젝트, 키워드, 경력 요약, 연락 */
import { Link } from 'react-router-dom';
import type { PublicProfileDto } from '@ppp/shared';
import { period, publicApi, useLoad } from '../api';
import { ProjectCard } from '../ProjectCard';

export function HomePage({ profile, profileLoading }: { profile: PublicProfileDto | null; profileLoading: boolean }) {
  const projects = useLoad(() => publicApi.projects(), []);
  const skills = useLoad(() => publicApi.skills(), []);
  const careers = useLoad(() => publicApi.careers(), []);

  const list = projects.data ?? [];
  const featured = list.filter((p) => p.isFeatured);
  const highlight = (featured.length ? featured : list).slice(0, 4);
  const keywords = (skills.data ?? []).flatMap((g) => g.skills).sort((a, b) => b.projects.length - a.projects.length);

  return (
    <>
      <section className="hero">
        <div className="eyebrow">DEVELOPER PORTFOLIO</div>
        {profileLoading ? (
          <div className="skeleton" style={{ height: 120, maxWidth: 560 }} />
        ) : (
          <>
            <h1>{profile?.headline || '문제를 구조화하고, 서비스로 구현합니다.'}</h1>
            <p className="hero-lead">{profile?.bio || '프로젝트의 목표와 역할, 기술적 선택, 결과를 기록하는 개인 개발 포트폴리오입니다.'}</p>
          </>
        )}
        <div className="hero-actions">
          <Link to="/projects" className="btn btn-primary">
            프로젝트 보기 →
          </Link>
          <a href="#contact" className="btn btn-secondary">
            연락하기
          </a>
        </div>
      </section>

      <section className="pub-section" aria-labelledby="work-title">
        <div className="section-head">
          <div>
            <div className="eyebrow">SELECTED WORK</div>
            <h2 id="work-title">{featured.length ? '대표 프로젝트' : '프로젝트'}</h2>
          </div>
          {list.length > highlight.length && (
            <Link to="/projects" className="btn btn-tertiary">
              전체 {list.length}개 보기 →
            </Link>
          )}
        </div>
        {projects.loading ? (
          <div className="pcards">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton" style={{ height: 320 }} />
            ))}
          </div>
        ) : projects.error ? (
          <p className="muted">프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        ) : highlight.length === 0 ? (
          <p className="muted">아직 공개된 프로젝트가 없습니다.</p>
        ) : (
          <div className="pcards">
            {highlight.map((p) => (
              <ProjectCard key={p.slug} p={p} large />
            ))}
          </div>
        )}
      </section>

      {keywords.length > 0 && (
        <section className="pub-section" aria-labelledby="kw-title">
          <div className="eyebrow">KEYWORDS</div>
          <h2 id="kw-title">기술 키워드</h2>
          <p className="kw-cloud">
            {keywords.map((k) => (
              <Link key={k.name} to={`/projects?keyword=${encodeURIComponent(k.name)}`} className="kw kw-lg">
                #{k.name}
                <span className="kw-count" aria-label={`프로젝트 ${k.projects.length}개`}>
                  {k.projects.length}
                </span>
              </Link>
            ))}
          </p>
        </section>
      )}

      {(careers.data?.length ?? 0) > 0 && (
        <section className="pub-section" aria-labelledby="career-title">
          <div className="eyebrow">EXPERIENCE</div>
          <h2 id="career-title">경력</h2>
          <ol className="timeline">
            {careers.data!.map((c, i) => (
              <li key={i}>
                <span className="timeline-period">{period(c.startDate, c.endDate)}</span>
                <div>
                  <b>{c.company}</b>
                  <span className="muted"> · {c.position}</span>
                  {c.description && <p className="prewrap">{c.description}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="pub-section contact" id="contact" aria-labelledby="contact-title">
        <div className="eyebrow">CONTACT</div>
        <h2 id="contact-title">연락</h2>
        {profile?.contactEmail || profile?.links?.length ? (
          <ul className="contact-list">
            {profile?.contactEmail && (
              <li>
                <a href={`mailto:${profile.contactEmail}`}>✉ {profile.contactEmail}</a>
              </li>
            )}
            {profile?.links?.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  ↗ {l.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">연락처는 준비 중입니다.</p>
        )}
      </section>
    </>
  );
}
