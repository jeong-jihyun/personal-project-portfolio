import { Global, Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

/** 인증 모듈. AuthGuard를 전역으로 내보내 각 Admin 모듈이 @UseGuards(AuthGuard)로 사용한다. */
@Global()
@Module({
  imports: [ActivityModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
