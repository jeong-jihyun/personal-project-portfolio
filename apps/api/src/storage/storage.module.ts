import { Controller, Get, Global, Inject, Module, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { createFileStorage, isLocalStorage, type FileStorage } from './file-storage.js';

export const FILE_STORAGE = Symbol('FILE_STORAGE');

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/** 로컬 개발 전용: 디스크에 저장한 업로드 파일 제공 (운영은 Vercel Blob URL을 직접 사용) */
@ApiExcludeController()
@Controller('uploads')
class LocalUploadsController {
  constructor(@Inject(FILE_STORAGE) private readonly storage: FileStorage) {}

  @Get(':folder/:file')
  async serve(@Param('folder') folder: string, @Param('file') file: string, @Res() res: Response): Promise<void> {
    if (!isLocalStorage(this.storage)) throw new NotFoundException();
    const buf = await this.storage.read(`${folder}/${file}`);
    if (!buf) throw new NotFoundException();
    res.setHeader('Content-Type', TYPES[file.split('.').pop() ?? ''] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Disposition', 'inline');
    res.end(buf);
  }
}

@Global()
@Module({
  controllers: [LocalUploadsController],
  providers: [{ provide: FILE_STORAGE, useFactory: () => createFileStorage() }],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
