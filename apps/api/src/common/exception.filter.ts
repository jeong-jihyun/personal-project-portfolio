import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError } from '@ppp/shared';
import { AppError, pgConstraint, pgErrorCode } from './errors.js';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'TOO_MANY_REQUESTS',
};

/** 모든 오류를 표준 오류 응답으로 변환한다. 내부 오류 상세는 응답에 노출하지 않는다. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const traceId = req.traceId ?? 'unknown';

    let status = 500;
    let body: Omit<ApiError, 'traceId'> = { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' };

    if (exception instanceof AppError) {
      status = exception.status;
      body = { code: exception.code, message: exception.message, details: exception.details };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      const message = typeof r === 'string' ? r : ((r as { message?: unknown }).message ?? exception.message);
      body = {
        code: STATUS_CODES[status] ?? 'HTTP_ERROR',
        message: Array.isArray(message) ? message.join(', ') : String(message),
      };
      if (status === 404) body.message = '요청한 경로를 찾을 수 없습니다.';
      if (status === 413) body.message = '파일이 너무 큽니다. 4MB 이하로 올려 주세요.';
    } else if (isBodyParserError(exception)) {
      status = exception.status;
      body = {
        code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
        message: status === 413 ? '요청 본문이 너무 큽니다.' : '요청 본문이 올바른 JSON이 아닙니다.',
      };
    } else {
      const pg = pgErrorCode(exception);
      if (pg === '23505') {
        status = 409;
        body = { code: 'DUPLICATE', message: '이미 존재하는 값입니다.', details: { constraint: pgConstraint(exception) } };
      } else if (pg === '23514' || pg === '22007' || pg === '22008' || pg === '22P02') {
        status = 400;
        body = { code: 'VALIDATION_ERROR', message: '입력값이 데이터 규칙을 위반했습니다.' };
      } else if (pg === '23503') {
        status = 409;
        body = { code: 'REFERENCE_CONFLICT', message: '연관된 데이터가 있어 처리할 수 없습니다.' };
      }
    }

    if (status >= 500) {
      this.logger.error(`[${traceId}] ${req.method} ${req.originalUrl}`, (exception as Error)?.stack ?? exception);
    }
    const payload: ApiError = { ...body, traceId };
    if (payload.details === undefined) delete payload.details;
    res.status(status).json(payload);
  }
}

function isBodyParserError(e: unknown): e is { status: number; type: string } {
  return (
    !!e &&
    typeof e === 'object' &&
    typeof (e as { status?: unknown }).status === 'number' &&
    typeof (e as { type?: unknown }).type === 'string' &&
    ['entity.parse.failed', 'entity.too.large', 'encoding.unsupported'].includes((e as { type: string }).type)
  );
}
