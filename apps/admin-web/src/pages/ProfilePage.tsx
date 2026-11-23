/** ADM-07 포트폴리오 설정: 공개 화면의 이름·소개·연락처·외부 링크와 프로필 게시 여부 */
import { useEffect, useState, type FormEvent } from 'react';
import { profileSchema, type ProfileDto, type ProfileLink, type PublicationStatus } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { ErrorState, Field } from '../components/ui';

interface FormState {
  displayName: string;
  headline: string;
  bio: string;
  contactEmail: string;
  location: string;
  links: ProfileLink[];
  publicationStatus: PublicationStatus;
}

export function ProfilePage() {
  const toast = useToast();
  const { refresh } = useAuth();
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<ProfileDto>('/admin/profile')
      .then((p) =>
        setForm({
          displayName: p.displayName,
          headline: p.headline ?? '',
          bio: p.bio ?? '',
          contactEmail: p.contactEmail ?? '',
          location: p.location ?? '',
          links: p.links,
          publicationStatus: p.publicationStatus,
        }),
      )
      .catch((e) => setLoadError(e instanceof ApiRequestError ? e.message : '불러오지 못했습니다.'));
  }, []);

  if (loadError) return <ErrorState message={loadError} />;
  if (!form) return <div className="skeleton" style={{ height: 400 }} aria-busy="true" />;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm({ ...form, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: '' });
  };
  const setLink = (i: number, patch: Partial<ProfileLink>) =>
    set(
      'links',
      form.links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...form, links: form.links.filter((l) => l.label.trim() || l.url.trim()) };
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[i.path.join('.')] ??= i.message;
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      await api<ProfileDto>('/admin/profile', { method: 'PUT', body: JSON.stringify(body) });
      setForm({ ...form, links: body.links });
      await refresh();
      toast('프로필을 저장했습니다.');
    } catch (err) {
      if (err instanceof ApiRequestError && Array.isArray(err.body.details)) {
        const next: Record<string, string> = {};
        for (const d of err.body.details as { path: string; message: string }[]) next[d.path] ??= d.message;
        setErrors(next);
      }
      toast(err instanceof ApiRequestError ? err.message : '저장하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const published = form.publicationStatus === 'PUBLISHED';

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-07 · PUBLISHING</div>
          <h1>포트폴리오 설정</h1>
          <p className="muted">공개 화면 맨 위에 보이는 이름·소개와 연락처를 관리합니다.</p>
        </div>
        <a className="btn btn-secondary" href="/portfolio/" target="_blank" rel="noopener">
          공개 화면 보기 ↗
        </a>
      </div>

      <form className="form-layout" onSubmit={onSubmit} noValidate>
        <section className="panel publish-bar">
          <div>
            <b>{published ? '프로필 공개 중' : '프로필 비공개'}</b>
            <span className="caption">
              {published ? '공개 화면에 이름·소개·연락처가 표시됩니다.' : '공개 화면에는 기본 문구만 표시되고 연락처는 숨겨집니다.'}
            </span>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={published} onChange={(e) => set('publicationStatus', e.target.checked ? 'PUBLISHED' : 'DRAFT')} />
            공개 화면에 프로필 표시
          </label>
        </section>

        <section className="panel">
          <h2 className="section-title">소개</h2>
          <Field id="pf-displayName" label="이름" required error={errors.displayName}>
            {(a) => <input {...a} value={form.displayName} maxLength={60} onChange={(e) => set('displayName', e.target.value)} />}
          </Field>
          <Field id="pf-headline" label="한 줄 소개 (공개 화면 큰 제목)" help="예: 문제를 구조화하고, 서비스로 구현합니다." error={errors.headline}>
            {(a) => <input {...a} value={form.headline} maxLength={160} onChange={(e) => set('headline', e.target.value)} />}
          </Field>
          <Field id="pf-bio" label="소개글" error={errors.bio}>
            {(a) => <textarea {...a} rows={4} value={form.bio} onChange={(e) => set('bio', e.target.value)} />}
          </Field>
        </section>

        <section className="panel">
          <h2 className="section-title">연락처</h2>
          <div className="form-grid">
            <Field id="pf-contactEmail" label="공개 이메일" help="공개 화면에 표시됩니다. 로그인 이메일과 달라도 됩니다." error={errors.contactEmail}>
              {(a) => <input {...a} type="email" inputMode="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />}
            </Field>
            <Field id="pf-location" label="지역" error={errors.location}>
              {(a) => <input {...a} value={form.location} maxLength={80} placeholder="예: 서울" onChange={(e) => set('location', e.target.value)} />}
            </Field>
          </div>

          <div className="field">
            <span className="label">외부 링크 (GitHub, 블로그, LinkedIn 등 · 최대 10개)</span>
            {form.links.map((l, i) => (
              <div key={i} className="link-row">
                <input
                  aria-label={`링크 ${i + 1} 이름`}
                  className="input"
                  placeholder="이름 (예: GitHub)"
                  value={l.label}
                  maxLength={40}
                  onChange={(e) => setLink(i, { label: e.target.value })}
                  aria-invalid={!!errors[`links.${i}.label`]}
                />
                <input
                  aria-label={`링크 ${i + 1} 주소`}
                  className="input"
                  placeholder="https://"
                  value={l.url}
                  inputMode="url"
                  onChange={(e) => setLink(i, { url: e.target.value })}
                  aria-invalid={!!errors[`links.${i}.url`]}
                />
                <button type="button" className="btn btn-danger btn-sm" onClick={() => set('links', form.links.filter((_, j) => j !== i))} aria-label={`링크 ${i + 1} 삭제`}>
                  삭제
                </button>
                {(errors[`links.${i}.label`] || errors[`links.${i}.url`]) && (
                  <span className="error link-error">{errors[`links.${i}.label`] || errors[`links.${i}.url`]}</span>
                )}
              </div>
            ))}
            {form.links.length < 10 && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('links', [...form.links, { label: '', url: '' }])}>
                ＋ 링크 추가
              </button>
            )}
          </div>
        </section>

        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </>
  );
}
