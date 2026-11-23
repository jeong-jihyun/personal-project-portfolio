/** PUB-04 경력: 전체 경력 */
import { publicApi, useLoad } from '../api';
import { CareerView, careerCount } from '../Career';

export function CareerPage() {
  const careers = useLoad(() => publicApi.careers(), []);
  const count = careerCount(careers.data);
  return (
    <section className="pub-section first">
      <div className="eyebrow">EXPERIENCE</div>
      <h1 className="page-title">경력</h1>
      {careers.loading ? (
        <div className="stack-skeleton">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
      ) : careers.error ? (
        <p className="muted">경력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
      ) : count === 0 ? (
        <p className="muted">아직 공개된 경력이 없습니다.</p>
      ) : (
        <CareerView data={careers.data!} />
      )}
    </section>
  );
}
