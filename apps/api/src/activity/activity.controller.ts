import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { ActivityDto, UserDto } from '@ppp/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../common/http.js';
import { ActivityService } from './activity.service.js';

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/activities')
export class ActivityController {
  constructor(@Inject(ActivityService) private readonly activity: ActivityService) {}

  /** 최근 변경 이력 (본인 것만) */
  @Get()
  list(@CurrentUser() user: UserDto, @Query('limit') limit?: string): Promise<{ items: ActivityDto[] }> {
    const n = Number(limit ?? 20);
    return this.activity.recent(user.id, Number.isFinite(n) ? n : 20).then((items) => ({ items }));
  }
}
