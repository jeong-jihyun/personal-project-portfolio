/** Zod 스키마를 OpenAPI 요청 본문 스키마로 노출해 DTO와 문서를 한 곳(@ppp/shared)에서 관리한다. */
import { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

export function ApiZodBody(schema: z.ZodType): MethodDecorator {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  delete json.$schema;
  return ApiBody({ schema: json as never });
}
