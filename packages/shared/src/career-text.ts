/**
 * 경력 텍스트 → 마크다운 변환.
 * 이력서에서 흔히 쓰는 형식을 알아본다:
 *   2025 | 프로젝트명(분야)
 *   ㆍ근무기간: `25.09.24~`25.12.19
 *   ㆍ기술스택: React, Oracle
 *   ㆍ주요 업무 및 성과
 *    ≫ 업무 내용
 */
const HEADING = /^\s*(\d{4}[^|]{0,20}?)\s*\|\s*(.+?)\s*$/;
const META = /^\s*[ㆍ·•]\s*(.+?)\s*$/;
const BULLET = /^\s*(?:≫|>>|»|▶|-|\*)\s*(.+?)\s*$/;

/** 붙여넣은 텍스트가 이 형식인지 (소제목 줄과 ㆍ/≫ 줄이 함께 있을 때) */
export function looksLikeCareerText(text: string): boolean {
  const lines = text.split(/\r?\n/);
  const headings = lines.filter((l) => HEADING.test(l)).length;
  const marks = lines.filter((l) => /^\s*(ㆍ|≫)/.test(l)).length;
  return headings >= 1 && marks >= 2;
}

/** 마크다운에서 특별한 뜻을 갖는 문자를 글자 그대로 보이게 한다 (백틱 날짜 `25.09.24 등) */
function escapeInline(s: string): string {
  return s.replace(/([\\`*_[\]<>])/g, '\\$1');
}

export function careerTextToMarkdown(text: string): string {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;

    const h = HEADING.exec(line);
    if (h) {
      if (out.length) out.push('');
      out.push(`### ${escapeInline(h[2]!)}`, '', `**${escapeInline(h[1]!.trim())}**`, '');
      continue;
    }

    const m = META.exec(line);
    if (m) {
      const body = m[1]!;
      const colon = body.search(/\s*:\s*/);
      if (colon > 0 && colon < 12) {
        const key = body.slice(0, colon).trim();
        const value = body.slice(colon).replace(/^\s*:\s*/, '');
        out.push(`- **${escapeInline(key)}**: ${escapeInline(value)}`);
      } else {
        out.push(`- **${escapeInline(body)}**`);
      }
      continue;
    }

    const b = BULLET.exec(line);
    if (b) {
      out.push(`  - ${escapeInline(b[1]!)}`);
      continue;
    }

    out.push(escapeInline(line.trim()));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
