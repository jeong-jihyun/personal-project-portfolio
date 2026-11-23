/** 공개 API 조회 (로그인 불필요) */
import type {
  PublicCareerDto,
  PublicProfileDto,
  PublicProjectDetailDto,
  PublicProjectSummaryDto,
  PublicSkillGroupDto,
} from '@ppp/shared';

export class NotFoundError extends Error {}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1/public${path}`);
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
  return res.json() as Promise<T>;
}

export const publicApi = {
  profile: () => get<PublicProfileDto>('/profile').catch((e) => (e instanceof NotFoundError ? null : Promise.reject(e))),
  projects: (keyword?: string) =>
    get<{ items: PublicProjectSummaryDto[] }>(`/projects${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`).then((r) => r.items),
  project: (slug: string) => get<PublicProjectDetailDto>(`/projects/${encodeURIComponent(slug)}`),
  careers: () => get<{ items: PublicCareerDto[]; markdown: string | null }>('/careers'),
  skills: () => get<{ items: PublicSkillGroupDto[] }>('/skills').then((r) => r.items),
};

/** 화면용 간단 데이터 로더 */
import { useEffect, useState } from 'react';
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: unknown; loading: boolean } {
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({ data: undefined, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: undefined, error, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function period(start: string | null, end: string | null): string {
  const f = (d: string) => d.slice(0, 7).replace('-', '.');
  if (!start && !end) return '';
  return `${start ? f(start) : ''} — ${end ? f(end) : '진행 중'}`;
}
