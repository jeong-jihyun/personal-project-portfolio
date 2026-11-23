import { Link } from 'react-router-dom';
import type { NavItem } from '../components/Layout';

/** 아직 구현하지 않은 메뉴: 어떤 단계에서 무엇이 생기는지 숨기지 않고 보여 준다. */
export function ComingSoonPage({ item }: { item: NavItem }) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{item.screen}</div>
          <h1>{item.label}</h1>
        </div>
      </div>
      <section className="panel coming">
        <span className="badge badge-planned">{item.step}단계에서 제공</span>
        <h2>아직 준비 중인 화면입니다</h2>
        <p className="muted">{item.description}</p>
        <Link to="/" className="btn btn-secondary">
          대시보드로 돌아가기
        </Link>
      </section>
    </>
  );
}
