/** 프로젝트 영역: 위에는 태그(키워드) 목록, 아래에는 갤러리형 카드 (PC 3열 · 모바일 2열) */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PublicProjectSummaryDto } from '@ppp/shared';
import { ProjectCard } from './ProjectCard';

export function ProjectGallery({ projects, loading, error }: { projects: PublicProjectSummaryDto[]; loading: boolean; error: unknown }) {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';

  const keywords = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of projects) for (const s of p.skills) count.set(s, (count.get(s) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [projects]);

  // 대표 프로젝트를 앞에 두고, 나머지는 받은 순서(노출 순서) 그대로
  const shown = useMemo(() => {
    const list = projects.filter((p) => !keyword || p.skills.some((s) => s.toLowerCase() === keyword.toLowerCase()));
    return [...list.filter((p) => p.isFeatured), ...list.filter((p) => !p.isFeatured)];
  }, [projects, keyword]);

  const select = (k: string) => {
    const next = new URLSearchParams(params);
    if (k) next.set('keyword', k);
    else next.delete('keyword');
    setParams(next, { replace: true, preventScrollReset: true });
  };

  return (
    <>
      {keywords.length > 0 && (
        <div className="filter" role="group" aria-label="키워드로 거르기">
          <button type="button" className={`kw${!keyword ? ' kw-on' : ''}`} aria-pressed={!keyword} onClick={() => select('')}>
            전체 <span className="kw-count">{projects.length}</span>
          </button>
          {keywords.map(([k, n]) => {
            const on = k.toLowerCase() === keyword.toLowerCase();
            return (
              <button key={k} type="button" className={`kw${on ? ' kw-on' : ''}`} aria-pressed={on} onClick={() => select(on ? '' : k)}>
                #{k} <span className="kw-count">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="pcards">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton pcard-skeleton" />
          ))}
        </div>
      ) : error ? (
        <p className="muted">프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : shown.length === 0 ? (
        <p className="muted">{keyword ? `#${keyword} 키워드의 프로젝트가 없습니다.` : '아직 공개된 프로젝트가 없습니다.'}</p>
      ) : (
        <div className="pcards">
          {shown.map((p) => (
            <ProjectCard key={p.slug} p={p} onKeyword={select} />
          ))}
        </div>
      )}
    </>
  );
}
