/**
 * 업로드 전 이미지 축소·변환 (브라우저).
 * - 최대 가로/세로 1920px, WebP(미지원 브라우저는 JPEG)로 다시 저장 → 모바일 데이터·업로드 시간 절약
 * - iPhone HEIC 등 브라우저가 열 수 있는 형식이면 변환되어 올라간다.
 * - 움직이는 GIF는 애니메이션이 사라지지 않도록 그대로 올린다(4MB 이하일 때).
 */
import { SCREENSHOT_MAX_BYTES } from '@ppp/shared';

const MAX_SIDE = 1920;

export class ImagePrepareError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImagePrepareError(`'${file.name}'은(는) 열 수 없는 이미지입니다.`));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File): Promise<File> {
  if (file.type === 'image/gif' && file.size <= SCREENSHOT_MAX_BYTES) return file;
  if (file.type && !file.type.startsWith('image/')) {
    throw new ImagePrepareError(`'${file.name}'은(는) 이미지 파일이 아닙니다.`);
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImagePrepareError('이미지를 처리할 수 없습니다.');
  ctx.drawImage(img, 0, 0, w, h);

  // Safari 일부 버전은 WebP 인코딩을 못 해서 PNG로 돌려준다 → 그 경우 JPEG로 저장
  let blob = await toBlob(canvas, 'image/webp', 0.85);
  let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', 0.85);
    ext = 'jpg';
  }
  for (let q = 0.75; blob && blob.size > SCREENSHOT_MAX_BYTES && q >= 0.45; q -= 0.15) {
    blob = await toBlob(canvas, ext === 'webp' ? 'image/webp' : 'image/jpeg', q);
  }
  if (!blob) throw new ImagePrepareError('이미지를 변환하지 못했습니다.');
  if (blob.size > SCREENSHOT_MAX_BYTES) throw new ImagePrepareError(`'${file.name}'이(가) 너무 커서 올릴 수 없습니다.`);

  const base = file.name.replace(/\.[^.]+$/, '') || 'screenshot';
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}
