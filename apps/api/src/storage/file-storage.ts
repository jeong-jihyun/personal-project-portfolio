/**
 * 파일 저장소. 운영(BLOB_READ_WRITE_TOKEN 있음)은 Vercel Blob, 로컬은 디스크(.data/uploads)에 저장한다.
 * 브라우저 localStorage나 DB에 파일 원본을 두지 않는다.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface StoredFile {
  url: string;
  key: string;
}

export interface FileStorage {
  readonly kind: 'vercel-blob' | 'local' | 'unconfigured';
  put(prefix: string, ext: string, body: Buffer, contentType: string): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

const randomName = (ext: string) => `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${ext}`;

class VercelBlobStorage implements FileStorage {
  readonly kind = 'vercel-blob' as const;
  async put(prefix: string, ext: string, body: Buffer, contentType: string): Promise<StoredFile> {
    const { put } = await import('@vercel/blob');
    const result = await put(`${prefix}/${randomName(ext)}`, body, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return { url: result.url, key: result.url };
  }
  async delete(key: string): Promise<void> {
    const { del } = await import('@vercel/blob');
    await del(key);
  }
}

export const LOCAL_UPLOAD_DIR = path.resolve(fileURLToPath(new URL('../../../../.data/uploads', import.meta.url)));
export const LOCAL_UPLOAD_ROUTE = '/api/v1/uploads';
const SAFE_KEY = /^[a-z0-9-]+\/[a-z0-9-]+\.(png|jpg|webp|gif)$/;

class LocalDiskStorage implements FileStorage {
  readonly kind = 'local' as const;
  constructor(private readonly dir: string) {}
  async put(prefix: string, ext: string, body: Buffer): Promise<StoredFile> {
    const key = `${prefix}/${randomName(ext)}`;
    await mkdir(path.join(this.dir, prefix), { recursive: true });
    await writeFile(path.join(this.dir, key), body);
    return { url: `${LOCAL_UPLOAD_ROUTE}/${key}`, key };
  }
  async delete(key: string): Promise<void> {
    if (!SAFE_KEY.test(key)) return;
    await rm(path.join(this.dir, key), { force: true });
  }
  /** 로컬 개발용 파일 제공. 키 형식을 검사해 경로 이탈을 막는다. */
  async read(key: string): Promise<Buffer | null> {
    if (!SAFE_KEY.test(key)) return null;
    return readFile(path.join(this.dir, key)).catch(() => null);
  }
}

/** 운영(Vercel)에서 Blob 토큰이 없을 때: 업로드 요청에 명확한 오류를 준다. */
class UnconfiguredStorage implements FileStorage {
  readonly kind = 'unconfigured' as const;
  put(): Promise<StoredFile> {
    return Promise.reject(new Error('STORAGE_NOT_CONFIGURED'));
  }
  async delete(): Promise<void> {}
}

export function createFileStorage(env: NodeJS.ProcessEnv = process.env): FileStorage {
  if (env.BLOB_READ_WRITE_TOKEN) return new VercelBlobStorage();
  if (env.VERCEL) return new UnconfiguredStorage();
  return new LocalDiskStorage(env.UPLOAD_DIR || LOCAL_UPLOAD_DIR);
}

export function isLocalStorage(s: FileStorage): s is LocalDiskStorage {
  return s.kind === 'local';
}
