/** API 호출 래퍼: 같은 출처의 /api/v1 로 요청하고, 표준 오류 응답을 ApiRequestError로 바꾼다. */
import type { ApiError } from '@ppp/shared';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
  ) {
    super(body.message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiRequestError(0, { code: 'NETWORK_ERROR', message: '서버에 연결할 수 없습니다.', traceId: '-' });
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      body ?? { code: 'HTTP_ERROR', message: `요청에 실패했습니다 (${res.status}).`, traceId: '-' },
    );
  }
  return body as T;
}
