/** PUB-01 홈: 소개 → 프로젝트(태그 + 갤러리 카드) → 경력 미리보기(최근 3개) → 연락 */
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { PublicProfileDto } from '@ppp/shared';
import { publicApi, useLoad } from '../api';
import { CareerView, careerCount } from '../Career';
import { ProjectGallery } from '../ProjectGallery';

const CAREER_PREVIEW = 3;

export function HomePage({ profile, profileLoading }: { profile: PublicProfileDto | null; profileLoading: boolean }) {
  const projects = useLoad(() => publicApi.projects(), []);
  const careers = useLoad(() => publicApi.careers(), []);
  const totalCareers = careerCount(careers.data);
  const { hash, key } = useLocation();

  // #contact 같은 앵커로 들어오면 내용이 다 그려진 뒤 그 위치로 이동 (하단 탭 '연락' 포함)
  useEffect(() => {
    if (!hash || projects.loading || careers.loading) return;
    const id = hash.slice(1);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [hash, key, projects.loading, careers.loading]);

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
          <a href="#work" className="btn btn-primary">
            프로젝트 보기 ↓
          </a>
          <a href="#contact" className="btn btn-secondary">
            연락하기
          </a>
        </div>
      </section>

      <section className="pub-section" id="work" aria-labelledby="work-title">
        <div className="eyebrow">PROJECTS</div>
        <h2 id="work-title">프로젝트</h2>
        <ProjectGallery projects={projects.data ?? []} loading={projects.loading} error={projects.error} />
      </section>

      {totalCareers > 0 && (
        <section className="pub-section" aria-labelledby="career-title">
          <div className="eyebrow">EXPERIENCE</div>
          <h2 id="career-title">최근 경력</h2>
          <CareerView data={careers.data!} limit={CAREER_PREVIEW} />
          <Link to="/career" className="more-link">
            경력 전체 보기{totalCareers > CAREER_PREVIEW ? ` (${totalCareers}건)` : ''} →
          </Link>
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
