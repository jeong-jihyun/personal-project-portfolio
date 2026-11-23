import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppError } from './errors.js';

/** Zod 스키마로 body/query를 검증하고 정규화된 값을 돌려준다. 필드 단위 오류를 details로 제공한다. */
export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      '입력값을 확인하세요.',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
}

/** UUID 경로 파라미터 검증. 잘못된 형식은 404로 취급해 존재 여부를 추측할 수 없게 한다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class UuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw new AppError(404, 'NOT_FOUND', '리소스를 찾을 수 없습니다.');
    return value.toLowerCase();
  }
}
