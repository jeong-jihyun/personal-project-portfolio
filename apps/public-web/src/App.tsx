/** Public Web (/portfolio): 로그인 없이 게시된 정보만 열람 (UI 설계서 PUB-01~06) */
import { useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { publicApi, useLoad } from './api';
import { HomePage } from './pages/HomePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function Shell() {
  const profile = useLoad(() => publicApi.profile(), []);
  const name = profile.data?.displayName ?? 'Portfolio';
  useEffect(() => {
    document.title = `${name} · 포트폴리오`;
  }, [name]);

  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="pub-nav">
        <Link to="/" className="pub-brand">
          {name}
        </Link>
        <nav aria-label="주요 메뉴">
          <NavLink to="/" end>
            홈
          </NavLink>
          <NavLink to="/projects">프로젝트</NavLink>
          <a href="/portfolio/#contact">연락</a>
        </nav>
      </header>
      <main id="main" className="pub-main" tabIndex={-1}>
        <Routes>
          <Route index element={<HomePage profile={profile.data ?? null} profileLoading={profile.loading} />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:slug" element={<ProjectDetailPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="pub-footer">
        <span>© {new Date().getFullYear()} {name}</span>
        <span className="muted">Personal Project Portfolio</span>
      </footer>
    </>
  );
}

export function NotFound() {
  return (
    <section className="pub-state">
      <h1>페이지를 찾을 수 없습니다</h1>
      <p className="muted">비공개로 바뀌었거나 주소가 잘못되었습니다.</p>
      <Link to="/projects" className="btn btn-secondary">
        프로젝트 목록으로
      </Link>
    </section>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/portfolio">
      <ScrollToTop />
      <Shell />
    </BrowserRouter>
  );
}
