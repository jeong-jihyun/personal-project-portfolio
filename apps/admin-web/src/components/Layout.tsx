/** 관리자 레이아웃: 데스크톱 좌측 사이드바, 모바일 하단 탐색 (UI 설계서 §1, §5). */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useToast } from './Toast';

/** 현재 완료된 개발 단계. 이 값보다 큰 단계의 메뉴는 '준비 중'으로 표시한다. */
export const CURRENT_STEP = 7;

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  screen: string;
  /** 이 메뉴가 실제로 동작하게 되는 단계 */
  step: number;
  description: string;
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '대시보드', icon: '▦', screen: 'ADM-01', step: 5, description: '프로젝트 현황과 최근 활동', mobile: true },
  { path: '/projects', label: '프로젝트 관리', icon: '▤', screen: 'ADM-02~04', step: 6, description: '프로젝트 목록·검색·등록·수정·삭제, 상태와 기간·역할·성과 관리', mobile: true },
  { path: '/repositories', label: 'Git 저장소', icon: '⌘', screen: 'ADM-05', step: 7, description: '프로젝트별 여러 저장소 등록, 브랜치·README·배포 URL, 대표 저장소와 공개 여부', mobile: true },
  { path: '/careers', label: '경력 및 기술', icon: '▣', screen: 'ADM-06', step: 8, description: '경력(회사·직무·기간)과 기술 스택(분류·순서), 산출물 링크' },
  { path: '/portfolio', label: '포트폴리오 설정', icon: '◎', screen: 'ADM-07', step: 9, description: '프로필, 대표 프로젝트, 노출 순서, 게시/비게시와 공개 화면 미리보기', mobile: true },
  { path: '/settings', label: '설정', icon: '⚙', screen: 'ADM-08', step: 10, description: '계정, 공개 URL, 기본 메타 정보' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    toast('로그아웃되었습니다.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="topbar">
        <div className="brand">
          PORTFOLIO<span>·</span>STUDIO
        </div>
        <div className="topbar-right">
          <span className="user-name" title={user?.email}>
            {user?.displayName}
          </span>
          <button className="btn btn-tertiary btn-sm" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>
      <div className="layout">
        <nav className="sidebar" aria-label="관리자 메뉴">
          <small>WORKSPACE</small>
          {NAV_ITEMS.slice(0, 5).map((n) => (
            <SideLink key={n.path} item={n} />
          ))}
          <small>SETTINGS</small>
          <SideLink item={NAV_ITEMS[5]!} />
        </nav>
        <main id="main" className="main" tabIndex={-1}>
          <div className="wrap">
            <Outlet />
          </div>
        </main>
      </div>
      <nav className="mobilebar" aria-label="모바일 메뉴">
        {NAV_ITEMS.filter((n) => n.mobile).map((n) => (
          <NavLink key={n.path} to={n.path} end={n.path === '/'}>
            <span aria-hidden="true">{n.icon}</span>
            {n.label.replace(' 관리', '').replace('포트폴리오 설정', '공개설정')}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.path} end={item.path === '/'} className="nav">
      <span aria-hidden="true" className="nav-icon">
        {item.icon}
      </span>
      <span>{item.label}</span>
      {item.step > CURRENT_STEP && <span className="nav-soon">{item.step}단계</span>}
    </NavLink>
  );
}
