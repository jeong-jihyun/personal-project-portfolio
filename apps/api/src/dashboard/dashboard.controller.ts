import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { DashboardDto, UserDto } from '@ppp/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../common/http.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: UserDto): Promise<DashboardDto> {
    return this.dashboard.get(user.id);
  }
}
