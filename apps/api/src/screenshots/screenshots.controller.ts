import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import multer from 'multer';
import {
  SCREENSHOT_MAX_BYTES,
  screenshotOrderSchema,
  screenshotUpdateSchema,
  type UserDto,
} from '@ppp/shared';
import type { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../common/http.js';
import { ApiZodBody } from '../common/openapi.js';
import { UuidPipe, ZodPipe } from '../common/zod.pipe.js';
import { ScreenshotsService } from './screenshots.service.js';

@ApiTags('admin')
@ApiCookieAuth('pps_session')
@UseGuards(AuthGuard)
@Controller('admin')
export class ScreenshotsController {
  constructor(@Inject(ScreenshotsService) private readonly screenshots: ScreenshotsService) {}

  /** multipart/form-data: file(이미지, 4MB 이하), title(선택) */
  @Post('projects/:projectId/screenshots')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' }, title: { type: 'string', maxLength: 120 } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      // 한글 파일명이 latin1로 깨지지 않도록 UTF-8로 해석
      defParamCharset: 'utf8',
      limits: { fileSize: SCREENSHOT_MAX_BYTES, files: 1, fields: 4 },
    }),
  )
  upload(
    @CurrentUser() user: UserDto,
    @Param('projectId', UuidPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { title?: string },
  ) {
    return this.screenshots.upload(user.id, projectId, file, typeof body?.title === 'string' ? body.title : undefined);
  }

  /** 순서 변경 (첫 번째 = 대표 이미지) */
  @Patch('projects/:projectId/screenshots/order')
  @ApiZodBody(screenshotOrderSchema)
  async reorder(
    @CurrentUser() user: UserDto,
    @Param('projectId', UuidPipe) projectId: string,
    @Body(new ZodPipe(screenshotOrderSchema)) body: z.output<typeof screenshotOrderSchema>,
  ) {
    return { items: await this.screenshots.reorder(user.id, projectId, body.assetIds) };
  }

  @Patch('screenshots/:assetId')
  @ApiZodBody(screenshotUpdateSchema)
  update(
    @CurrentUser() user: UserDto,
    @Param('assetId', UuidPipe) assetId: string,
    @Body(new ZodPipe(screenshotUpdateSchema)) body: z.output<typeof screenshotUpdateSchema>,
  ) {
    return this.screenshots.update(user.id, assetId, body);
  }

  @Delete('screenshots/:assetId')
  @HttpCode(204)
  remove(@CurrentUser() user: UserDto, @Param('assetId', UuidPipe) assetId: string) {
    return this.screenshots.remove(user.id, assetId);
  }
}
