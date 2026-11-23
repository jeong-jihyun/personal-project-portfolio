/** ADM-08 설정: 계정 정보, 비밀번호 변경, 공개 주소 */
import { useState, type FormEvent } from 'react';
import { passwordChangeSchema } from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { Field } from '../components/ui';

export function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const publicUrl = `${window.location.origin}/portfolio/`;

  const set = (k: keyof typeof form, v: string) => {
    setForm({ ...form, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: '' });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const parsed = passwordChangeSchema.safeParse(form);
    if (!parsed.success) for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
    if (form.newPassword !== form.confirm) next.confirm = '새 비밀번호가 서로 다릅니다.';
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      await api('/auth/session/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast('비밀번호를 바꿨습니다. 다른 기기의 로그인은 해제되었습니다.');
    } catch (err) {
      if (err instanceof ApiRequestError && Array.isArray(err.body.details)) {
        const fe: Record<string, string> = {};
        for (const d of err.body.details as { path: string; message: string }[]) fe[d.path] ??= d.message;
        setErrors(fe);
      }
      toast(err instanceof ApiRequestError ? err.message : '바꾸지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast('공개 주소를 복사했습니다.');
    } catch {
      toast('복사하지 못했습니다. 주소를 직접 선택해 복사하세요.', 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-08 · SETTINGS</div>
          <h1>설정</h1>
          <p className="muted">계정과 공개 주소를 관리합니다.</p>
        </div>
      </div>

      <div className="form-layout">
        <section className="panel">
          <h2 className="section-title">계정</h2>
          <dl className="meta">
            <dt>로그인 이메일</dt>
            <dd>{user?.email}</dd>
            <dt>표시 이름</dt>
            <dd>{user?.displayName} <span className="caption">(포트폴리오 설정에서 변경)</span></dd>
          </dl>
        </section>

        <section className="panel">
          <h2 className="section-title">공개 주소</h2>
          <div className="copy-row">
            <code className="break">{publicUrl}</code>
            <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
              복사
            </button>
            <a className="btn btn-tertiary btn-sm" href={publicUrl} target="_blank" rel="noopener">
              열기 ↗
            </a>
          </div>
          <p className="caption" style={{ marginTop: 8 }}>
            이 주소를 이력서·명함에 넣으면 방문자가 게시된 프로젝트와 경력을 볼 수 있습니다. 개인 도메인 연결은 Vercel 프로젝트 설정 → Domains 에서 할 수 있습니다.
          </p>
        </section>

        <section className="panel">
          <h2 className="section-title">비밀번호 변경</h2>
          <p className="caption" style={{ marginBottom: 12 }}>
            바꾸면 지금 쓰는 기기는 로그인이 유지되고, 다른 기기는 모두 로그아웃됩니다.
          </p>
          <form onSubmit={onSubmit} noValidate>
            <input type="text" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
            <Field id="s-current" label="현재 비밀번호" required error={errors.currentPassword}>
              {(a) => <input {...a} type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => set('currentPassword', e.target.value)} />}
            </Field>
            <div className="form-grid">
              <Field id="s-new" label="새 비밀번호" required help="10자 이상" error={errors.newPassword}>
                {(a) => <input {...a} type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => set('newPassword', e.target.value)} />}
              </Field>
              <Field id="s-confirm" label="새 비밀번호 확인" required error={errors.confirm}>
                {(a) => <input {...a} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} />}
              </Field>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? '변경 중…' : '비밀번호 변경'}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
