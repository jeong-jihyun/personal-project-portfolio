import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { loginSchema, type LoginInput, type UserDto } from '@ppp/shared';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { CONFIG } from '../common/tokens.js';
import { ZodPipe } from '../common/zod.pipe.js';
import type { AppConfig } from '../config.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService, SESSION_COOKIE } from './auth.service.js';

@ApiTags('auth')
@Controller('auth/session')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** 로그인: 세션 쿠키(httpOnly, SameSite=Lax, 운영은 Secure)를 발급한다. */
  @Post()
  @ApiZodBody(loginSchema)
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserDto; expiresAt: string }> {
    const { token, expiresAt, user } = await this.auth.login(body, req.ip ?? 'unknown');
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.cookieSecure,
      path: '/api',
      expires: expiresAt,
    });
    return { user, expiresAt: expiresAt.toISOString() };
  }

  /** 현재 로그인 사용자 */
  @Get()
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: UserDto): { user: UserDto } {
    return { user };
  }

  /** 로그아웃: 서버 세션 삭제 + 쿠키 제거. 로그인 상태가 아니어도 204. */
  @Delete()
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: '/api', httpOnly: true, sameSite: 'lax', secure: this.config.cookieSecure });
  }
}
