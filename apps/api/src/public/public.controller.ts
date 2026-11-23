import { Controller, Get, Header, Inject, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicService } from './public.service.js';

/** 로그인 없이 열람하는 공개 API. CDN에서 1분 캐시, 이후 5분간 이전 응답을 보여 주며 갱신한다. */
const CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

@ApiTags('public')
@Controller('public')
export class PublicController {
  constructor(@Inject(PublicService) private readonly pub: PublicService) {}

  @Get('profile')
  @Header('Cache-Control', CACHE)
  profile() {
    return this.pub.profile();
  }

  /** 선택: keyword (예: React 또는 #React) */
  @Get('projects')
  @Header('Cache-Control', CACHE)
  async projects(@Query('keyword') keyword?: string) {
    return { items: await this.pub.projects(typeof keyword === 'string' ? keyword.slice(0, 50) : undefined) };
  }

  @Get('projects/:slug')
  @Header('Cache-Control', CACHE)
  project(@Param('slug') slug: string) {
    return this.pub.project(slug);
  }

  @Get('careers')
  @Header('Cache-Control', CACHE)
  async careers() {
    const [items, markdown] = await Promise.all([this.pub.careers(), this.pub.careerMarkdown()]);
    return { items, markdown };
  }

  @Get('skills')
  @Header('Cache-Control', CACHE)
  async skills() {
    return { items: await this.pub.skills() };
  }
}
