/** 도메인 오류. 전역 필터가 { code, message, details, traceId } 로 변환한다. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = '리소스') => new AppError(404, 'NOT_FOUND', `${what}을(를) 찾을 수 없습니다.`);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);
export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = () => new AppError(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
export const forbidden = (message = '접근 권한이 없습니다.') => new AppError(403, 'FORBIDDEN', message);

/** PostgreSQL 오류 코드 추출 (Drizzle는 원본 오류를 cause로 감싼다). */
export function pgErrorCode(err: unknown): string | undefined {
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur && typeof cur === 'object'; i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export function pgConstraint(err: unknown): string | undefined {
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur && typeof cur === 'object'; i++) {
    const c = (cur as { constraint?: unknown }).constraint;
    if (typeof c === 'string') return c;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}
