/** PUB-02 프로젝트 목록: 키워드 필터, 프로젝트 카드 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { publicApi, useLoad } from '../api';
import { ProjectCard } from '../ProjectCard';

export function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const keyword = params.get('keyword') ?? '';
  const all = useLoad(() => publicApi.projects(), []);

  const keywords = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of all.data ?? []) for (const s of p.skills) count.set(s, (count.get(s) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all.data]);

  const shown = (all.data ?? []).filter((p) => !keyword || p.skills.some((s) => s.toLowerCase() === keyword.toLowerCase()));

  return (
    <section className="pub-section first">
      <div className="eyebrow">PROJECTS</div>
      <h1 className="page-title">프로젝트</h1>

      {keywords.length > 0 && (
        <div className="filter" role="group" aria-label="키워드로 거르기">
          <button type="button" className={`kw${!keyword ? ' kw-on' : ''}`} aria-pressed={!keyword} onClick={() => setParams({}, { replace: true })}>
            전체 {all.data?.length ?? 0}
          </button>
          {keywords.map(([k, n]) => {
            const on = k.toLowerCase() === keyword.toLowerCase();
            return (
              <button
                key={k}
                type="button"
                className={`kw${on ? ' kw-on' : ''}`}
                aria-pressed={on}
                onClick={() => setParams(on ? {} : { keyword: k }, { replace: true })}
              >
                #{k} <span className="kw-count">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {all.loading ? (
        <div className="pcards">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 300 }} />
          ))}
        </div>
      ) : all.error ? (
        <p className="muted">프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : shown.length === 0 ? (
        <p className="muted">{keyword ? `#${keyword} 키워드의 프로젝트가 없습니다.` : '아직 공개된 프로젝트가 없습니다.'}</p>
      ) : (
        <div className="pcards">
          {shown.map((p) => (
            <ProjectCard key={p.slug} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
