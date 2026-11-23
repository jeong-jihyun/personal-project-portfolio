import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { LoginInput, UserDto } from '@ppp/shared';
import { AppError } from '../common/errors.js';
import { CONFIG, DB } from '../common/tokens.js';
import type { AppConfig } from '../config.js';
import type { Database } from '../db/database.js';
import { sessions, users } from '../db/schema.js';
import { ActivityService } from '../activity/activity.service.js';
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password.js';

export const SESSION_COOKIE = 'pps_session';

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * 세션 인증. 브라우저에는 httpOnly 쿠키로 무작위 토큰만 전달하고, 서버(DB)에는 토큰의 SHA-256 해시만 저장한다.
 * 외부 인증 공급자를 도입할 때는 login 단계만 교체하면 된다 (API 설계서 §3 Auth).
 *
 * 로그인 실패 제한: 같은 (클라이언트, 이메일) 조합이 15분 안에 5번 실패하면 429.
 * 서버리스 인스턴스별 메모리 기준이므로 완전한 차단은 아니며, 운영에서는 Vercel Firewall 규칙을 함께 쓴다.
 */
@Injectable()
export class AuthService {
  private readonly failures = new Map<string, { count: number; resetAt: number }>();

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  async login(input: LoginInput, clientKey: string): Promise<{ token: string; expiresAt: Date; user: UserDto }> {
    const key = `${clientKey}|${input.email}`;
    const now = Date.now();
    const f = this.failures.get(key);
    if (f && f.resetAt > now && f.count >= MAX_FAILURES) {
      throw new AppError(429, 'TOO_MANY_ATTEMPTS', '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.', {
        retryAfterSeconds: Math.ceil((f.resetAt - now) / 1000),
      });
    }

    const [user] = await this.db.select().from(users).where(eq(users.email, input.email));
    // 사용자가 없어도 같은 비용으로 검증해 계정 존재 여부가 응답 시간으로 드러나지 않게 한다.
    const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !ok) {
      const entry = f && f.resetAt > now ? f : { count: 0, resetAt: now + FAILURE_WINDOW_MS };
      entry.count += 1;
      this.failures.set(key, entry);
      throw new AppError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    this.failures.delete(key);

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now + this.config.sessionTtlHours * 3600 * 1000);
    await this.db.insert(sessions).values({ id: hashToken(token), userId: user.id, expiresAt });
    // 같은 사용자의 만료 세션 정리
    await this.db.delete(sessions).where(and(eq(sessions.userId, user.id), lt(sessions.expiresAt, new Date())));
    await this.activity.log({ actorId: user.id, entityType: 'SESSION', action: 'LOGIN', summary: '로그인' });

    return { token, expiresAt, user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  async userForToken(token: string | undefined): Promise<UserDto | null> {
    if (!token || token.length > 200) return null;
    const [row] = await this.db
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())));
    return row ?? null;
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
}
