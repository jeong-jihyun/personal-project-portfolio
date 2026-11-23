import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { CURRENT_STEP, Layout, NAV_ITEMS } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectFormPage } from './pages/ProjectFormPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { CareersPage } from './pages/CareersPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="boot" role="status">
        <span className="sr-only">로그인 상태 확인 중</span>
        <div className="skeleton" style={{ width: 220, height: 20 }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Layout />;
}

export function App() {
  return (
    <BrowserRouter basename="/admin">
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route index element={<DashboardPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/new" element={<ProjectFormPage />} />
              <Route path="projects/:id" element={<ProjectDetailPage key="detail" />} />
              <Route path="projects/:id/edit" element={<ProjectFormPage key="edit" />} />
              <Route path="repositories" element={<RepositoriesPage />} />
              <Route path="careers" element={<CareersPage />} />
              <Route path="portfolio" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              {NAV_ITEMS.filter((n) => n.step > CURRENT_STEP).map((n) => (
                <Route key={n.path} path={n.path.slice(1)} element={<ComingSoonPage item={n} />} />
              ))}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <div className="state">
      <h2>페이지를 찾을 수 없습니다</h2>
      <p>주소를 확인하거나 왼쪽 메뉴에서 이동하세요.</p>
    </div>
  );
}

