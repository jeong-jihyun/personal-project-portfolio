/**
 * 파일 앞부분(매직 바이트)으로 이미지 형식을 판별한다. 확장자·Content-Type은 믿지 않는다.
 * SVG는 스크립트를 담을 수 있으므로 허용하지 않는다.
 */
export interface SniffedImage {
  contentType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  ext: 'png' | 'jpg' | 'webp' | 'gif';
  width: number | null;
  height: number | null;
}

export function sniffImage(buf: Buffer): SniffedImage | null {
  if (buf.length < 16) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR 너비·높이 (16~23)
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const ok = buf.length >= 24;
    return { contentType: 'image/png', ext: 'png', width: ok ? buf.readUInt32BE(16) : null, height: ok ? buf.readUInt32BE(20) : null };
  }

  // GIF: "GIF87a" / "GIF89a", 너비·높이 (6~9, little endian)
  const head6 = buf.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') {
    return { contentType: 'image/gif', ext: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // WebP: "RIFF" .... "WEBP"
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { contentType: 'image/webp', ext: 'webp', ...webpSize(buf) };
  }

  // JPEG: FF D8 FF, SOF 마커에서 크기
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: 'jpg', ...jpegSize(buf) };
  }
  return null;
}

function webpSize(buf: Buffer): { width: number | null; height: number | null } {
  const chunk = buf.subarray(12, 16).toString('latin1');
  try {
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  } catch {
    /* 크기를 못 읽어도 형식은 유효 */
  }
  return { width: null, height: null };
}

function jpegSize(buf: Buffer): { width: number | null; height: number | null } {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { width: null, height: null };
}
