/** 경력 표시: 마크다운(### 프로젝트 단위) 또는 항목 목록. limit 을 주면 앞에서부터 그 개수만 보여 준다. */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PublicCareerDto } from '@ppp/shared';
import { period } from './api';

export interface CareerData {
  items: PublicCareerDto[];
  markdown: string | null;
}

/** 마크다운을 '### ' 소제목 단위 블록으로 나눈다. 첫 소제목 앞의 글은 머리말로 둔다. */
export function splitCareerMarkdown(md: string): { intro: string; blocks: string[] } {
  const parts = md.split(/\n(?=###\s)/);
  const first = parts[0] ?? '';
  if (/^###\s/.test(first)) return { intro: '', blocks: parts };
  return { intro: first.trim(), blocks: parts.slice(1) };
}

export function careerCount(data: CareerData | undefined): number {
  if (!data) return 0;
  if (data.markdown) return splitCareerMarkdown(data.markdown).blocks.length || 1;
  return data.items.length;
}

export function CareerView({ data, limit }: { data: CareerData; limit?: number }) {
  if (data.markdown) {
    const { blocks } = splitCareerMarkdown(data.markdown);
    // 미리보기: 소제목 블록 앞에서부터 limit 개를 카드로 (세부 업무 줄은 숨김)
    if (limit && blocks.length) {
      return (
        <div className="career-preview">
          {blocks.slice(0, limit).map((b, i) => (
            <div key={i} className="markdown career-md career-card">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{b}</ReactMarkdown>
            </div>
          ))}
        </div>
      );
    }
    const md = data.markdown;
    return (
      <div className="markdown career-md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </div>
    );
  }
  const items = limit ? data.items.slice(0, limit) : data.items;
  return (
    <ol className="timeline">
      {items.map((c, i) => (
        <li key={i}>
          <span className="timeline-period">{period(c.startDate, c.endDate)}</span>
          <div>
            <b>{c.company}</b>
            <span className="muted"> · {c.position}</span>
            {c.description && <p className="prewrap">{c.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
