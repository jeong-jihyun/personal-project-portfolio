/** 로그인 상태: 앱 시작 시 GET /auth/session 으로 세션을 확인한다. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserDto } from '@ppp/shared';
import { api, ApiRequestError } from './api';

interface AuthState {
  user: UserDto | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: UserDto }>('/auth/session')
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (!(e instanceof ApiRequestError) || e.status !== 401) console.error(e);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: UserDto }>('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/session', { method: 'DELETE' }).catch(() => undefined);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider가 필요합니다.');
  return ctx;
}
