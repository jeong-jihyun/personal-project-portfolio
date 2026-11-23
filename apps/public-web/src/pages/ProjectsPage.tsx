/** PUB-02 프로젝트 목록: 태그(키워드) 필터 + 갤러리형 카드 */
import { publicApi, useLoad } from '../api';
import { ProjectGallery } from '../ProjectGallery';

export function ProjectsPage() {
  const all = useLoad(() => publicApi.projects(), []);
  return (
    <section className="pub-section first">
      <div className="eyebrow">PROJECTS</div>
      <h1 className="page-title">프로젝트</h1>
      <ProjectGallery projects={all.data ?? []} loading={all.loading} error={all.error} />
    </section>
  );
}
