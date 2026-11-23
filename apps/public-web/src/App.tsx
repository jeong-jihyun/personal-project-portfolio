/** Public Web (/portfolio): 로그인 없이 게시된 정보만 열람 (UI 설계서 PUB-01~06) */
import { useEffect, useRef } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { publicApi, useLoad } from './api';
import { CareerPage } from './pages/CareerPage';
import { HomePage } from './pages/HomePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';

function ScrollToTop() {
  const { pathname, hash, key, search } = useLocation();
  const prev = useRef({ pathname, search });
  // 다른 화면으로 이동하거나 같은 탭을 다시 누르면 맨 위로.
  // #앵커 이동은 HomePage가, 태그·페이지(?keyword, ?page) 변경은 목록이 위치를 처리한다.
  useEffect(() => {
    const p = prev.current;
    prev.current = { pathname, search };
    if (hash) return;
    if (p.pathname !== pathname || p.search === search) window.scrollTo(0, 0);
  }, [pathname, search, hash, key]);
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
        <Link to="/" className="pub-brand" aria-label={`${name} 포트폴리오 홈`}>
          <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="Portfolio Studio" width={240} height={24} />
        </Link>
        <nav aria-label="주요 메뉴">
          <NavLink to="/" end>
            홈
          </NavLink>
          <NavLink to="/projects">프로젝트</NavLink>
          <NavLink to="/career">경력</NavLink>
          <a href="/portfolio/#contact">연락</a>
        </nav>
      </header>
      <TabBar />
      <main id="main" className="pub-main" tabIndex={-1}>
        <Routes>
          <Route index element={<HomePage profile={profile.data ?? null} profileLoading={profile.loading} />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:slug" element={<ProjectDetailPage />} />
          <Route path="career" element={<CareerPage />} />
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

/** 모바일 하단 고정 탭 (PC는 상단 메뉴 사용) */
const ICON = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  projects: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  career: 'M9 6V4h6v2h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 0h6M3 12h18',
  contact: 'M3 6h18v12H3zM3 6l9 7 9-7',
};
function TabIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
function TabBar() {
  return (
    <nav className="pub-tabbar" aria-label="하단 메뉴">
      <NavLink to="/" end>
        <TabIcon d={ICON.home} />홈
      </NavLink>
      <NavLink to="/projects">
        <TabIcon d={ICON.projects} />프로젝트
      </NavLink>
      <NavLink to="/career">
        <TabIcon d={ICON.career} />경력
      </NavLink>
      <Link to={{ pathname: '/', hash: '#contact' }}>
        <TabIcon d={ICON.contact} />연락
      </Link>
    </nav>
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
