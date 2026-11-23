import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema } from '@ppp/shared';
import { ApiRequestError } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (user) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      toast('로그인되었습니다.');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="Portfolio Studio" width={220} height={22} />
        </div>
        <h1>관리자 로그인</h1>
        <p className="muted">프로젝트와 포트폴리오를 관리하려면 로그인하세요.</p>

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        <div className="field">
          <label htmlFor="email">
            이메일<span className="required">*</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            autoFocus
          />
          {fieldErrors.email && (
            <span id="email-error" className="error">
              {fieldErrors.email}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">
            비밀번호<span className="required">*</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password && (
            <span id="password-error" className="error">
              {fieldErrors.password}
            </span>
          )}
        </div>
        <button className="btn btn-primary login-submit" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}
