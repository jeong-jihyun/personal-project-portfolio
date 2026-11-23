/**
 * 프로젝트 영역: 위에는 태그(키워드) 목록, 아래에는 갤러리형 카드 (PC 3열 · 모바일 2열)
 * 나눠 보기: PC는 번호 페이지(9개씩), 모바일은 아래로 스크롤하면 8개씩 자동으로 더 보여 준다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PublicProjectSummaryDto } from '@ppp/shared';
import { ProjectCard } from './ProjectCard';

const PC_PAGE = 9;
const MOBILE_STEP = 8;
const MOBILE_QUERY = '(max-width: 760px)';

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

export function ProjectGallery({ projects, loading, error }: { projects: PublicProjectSummaryDto[]; loading: boolean; error: unknown }) {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const isMobile = useIsMobile();
  const topRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(MOBILE_STEP);

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

  const pages = Math.max(1, Math.ceil(shown.length / PC_PAGE));
  const page = Math.min(pages, Math.max(1, Number(params.get('page')) || 1));
  const visible = isMobile ? shown.slice(0, count) : shown.slice((page - 1) * PC_PAGE, page * PC_PAGE);

  // 태그를 바꾸면 모바일 목록도 처음 개수로
  useEffect(() => setCount(MOBILE_STEP), [keyword]);

  // 모바일: 목록 끝이 화면에 가까워지면 다음 묶음을 붙인다
  useEffect(() => {
    const el = moreRef.current;
    if (!isMobile || !el || count >= shown.length) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setCount((c) => c + MOBILE_STEP);
    }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [isMobile, count, shown.length]);

  const select = (k: string) => {
    const next = new URLSearchParams(params);
    if (k) next.set('keyword', k);
    else next.delete('keyword');
    next.delete('page');
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const goPage = (n: number) => {
    const next = new URLSearchParams(params);
    if (n > 1) next.set('page', String(n));
    else next.delete('page');
    setParams(next, { preventScrollReset: true });
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div ref={topRef} className="gallery-top" />
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
        <>
          <div className="pcards">
            {visible.map((p) => (
              <ProjectCard key={p.slug} p={p} onKeyword={select} />
            ))}
          </div>
          {isMobile ? (
            count < shown.length ? (
              <div ref={moreRef} className="more-loading" aria-live="polite">
                불러오는 중… ({Math.min(count, shown.length)} / {shown.length})
              </div>
            ) : (
              shown.length > MOBILE_STEP && <p className="more-end">프로젝트 {shown.length}개를 모두 보았습니다.</p>
            )
          ) : (
            pages > 1 && <PageNav page={page} pages={pages} onPage={goPage} />
          )}
        </>
      )}
    </>
  );
}

/** PC 번호 페이지: ‹ 1 2 3 › (페이지가 많으면 가운데를 … 로 줄임) */
function PageNav({ page, pages, onPage }: { page: number; pages: number; onPage(n: number): void }) {
  const nums: (number | '…')[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 2) nums.push(n);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav className="pager" aria-label="프로젝트 페이지">
      <button type="button" className="pager-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="이전 페이지">
        ‹
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`gap${i}`} className="pager-gap">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={`pager-btn${n === page ? ' pager-on' : ''}`}
            aria-current={n === page ? 'page' : undefined}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" className="pager-btn" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="다음 페이지">
        ›
      </button>
    </nav>
  );
}
