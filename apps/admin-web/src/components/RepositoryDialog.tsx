/** 저장소 등록/수정 대화상자 (ADM-05). 프로젝트 상세와 Git 저장소 화면에서 함께 쓴다. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  REPOSITORY_PROVIDERS,
  REPOSITORY_PROVIDER_LABEL,
  repositoryCreateSchema,
  type ProjectSummaryDto,
  type RepositoryDto,
  type RepositoryProvider,
  type Visibility,
} from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useToast } from './Toast';
import { Field } from './ui';

interface FormState {
  projectId: string;
  provider: RepositoryProvider;
  name: string;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
  developmentBranch: string;
  visibility: Visibility;
  readmeUrl: string;
  deploymentUrl: string;
  isPrimary: boolean;
}

/** URL에서 저장소 이름과 제공자를 추정 (https://github.com/owner/name(.git), git@host:owner/name.git) */
function guessFromUrl(url: string): { name?: string; provider?: RepositoryProvider } {
  const m = /^(?:https?:\/\/|ssh:\/\/(?:[^@/]+@)?|[^@\s]+@)([^/:]+)[/:](?:[^/]+\/)*([^/]+?)(?:\.git)?\/?$/.exec(url.trim());
  if (!m) return {};
  const host = m[1]!.toLowerCase();
  const provider: RepositoryProvider = host.includes('github')
    ? 'GITHUB'
    : host.includes('gitlab')
      ? 'GITLAB'
      : host.includes('bitbucket')
        ? 'BITBUCKET'
        : 'OTHER';
  return { name: m[2], provider };
}

export function RepositoryDialog(props: {
  repository?: RepositoryDto;
  /** 프로젝트 상세에서 열면 고정, Git 저장소 화면에서 열면 선택 */
  projectId?: string;
  projects?: Pick<ProjectSummaryDto, 'id' | 'title'>[];
  onClose(): void;
  onSaved(repo: RepositoryDto): void;
}) {
  const r = props.repository;
  const isEdit = !!r;
  const toast = useToast();
  const firstRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({
    projectId: r?.projectId ?? props.projectId ?? '',
    provider: r?.provider ?? 'GITHUB',
    name: r?.name ?? '',
    url: r?.url ?? '',
    cloneUrl: r?.cloneUrl ?? '',
    defaultBranch: r?.defaultBranch ?? 'main',
    developmentBranch: r?.developmentBranch ?? '',
    visibility: r?.visibility ?? 'PRIVATE',
    readmeUrl: r?.readmeUrl ?? '',
    deploymentUrl: r?.deploymentUrl ?? '',
    isPrimary: r?.isPrimary ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, props]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e));
  };

  const onUrlBlur = () => {
    if (isEdit) return;
    const g = guessFromUrl(form.url);
    setForm((f) => ({ ...f, name: f.name || g.name || '', provider: g.provider ?? f.provider }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const { projectId, ...body } = form;
    const next: Record<string, string> = {};
    if (!projectId) next.projectId = '프로젝트를 선택하세요.';
    const parsed = repositoryCreateSchema.safeParse(body);
    if (!parsed.success) for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      const saved = await api<RepositoryDto>(isEdit ? `/admin/repositories/${r!.id}` : `/admin/projects/${projectId}/repositories`, {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      toast(isEdit ? '저장소가 수정되었습니다.' : '저장소가 등록되었습니다.');
      props.onSaved(saved);
    } catch (err) {
      if (err instanceof ApiRequestError && Array.isArray(err.body.details)) {
        const fe: Record<string, string> = {};
        for (const d of err.body.details as { path: string; message: string }[]) fe[d.path] ??= d.message;
        setErrors(fe);
      }
      toast(err instanceof ApiRequestError ? err.message : '저장하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof FormState, a: object, extra: object = {}) => (
    <input {...a} {...extra} value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} />
  );

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && props.onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="repo-title" onSubmit={onSubmit} noValidate>
        <div className="dialog-head">
          <h2 id="repo-title">{isEdit ? '저장소 수정' : '저장소 등록'}</h2>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={props.onClose} disabled={busy}>
            닫기
          </button>
        </div>

        {!props.projectId && !isEdit && (
          <Field id="r-projectId" label="프로젝트" required error={errors.projectId}>
            {(a) => (
              <select {...a} value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
                <option value="">프로젝트 선택</option>
                {props.projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        <Field
          id="r-url"
          label="저장소 URL"
          required
          help="https://github.com/owner/repo 또는 git@github.com:owner/repo.git — 입력하면 이름을 자동으로 채웁니다."
          error={errors.url}
        >
          {(a) => (
            <input
              {...a}
              ref={firstRef}
              value={form.url}
              spellCheck={false}
              placeholder="https://github.com/owner/repo"
              onChange={(e) => set('url', e.target.value)}
              onBlur={onUrlBlur}
            />
          )}
        </Field>
        <div className="form-grid">
          <Field id="r-name" label="저장소 이름" required error={errors.name}>
            {(a) => input('name', a, { maxLength: 100 })}
          </Field>
          <Field id="r-provider" label="제공자" error={errors.provider}>
            {(a) => (
              <select {...a} value={form.provider} onChange={(e) => set('provider', e.target.value as RepositoryProvider)}>
                {REPOSITORY_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {REPOSITORY_PROVIDER_LABEL[p]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field id="r-defaultBranch" label="기본 브랜치" error={errors.defaultBranch}>
            {(a) => input('defaultBranch', a, { placeholder: 'main' })}
          </Field>
          <Field id="r-developmentBranch" label="개발 브랜치" error={errors.developmentBranch}>
            {(a) => input('developmentBranch', a, { placeholder: 'develop' })}
          </Field>
          <Field id="r-readmeUrl" label="README URL" error={errors.readmeUrl}>
            {(a) => input('readmeUrl', a, { placeholder: 'https://…', spellCheck: false })}
          </Field>
          <Field id="r-deploymentUrl" label="배포 URL" error={errors.deploymentUrl}>
            {(a) => input('deploymentUrl', a, { placeholder: 'https://…', spellCheck: false })}
          </Field>
        </div>
        <Field id="r-cloneUrl" label="Clone URL (선택)" help="공개 화면에는 표시되지 않습니다." error={errors.cloneUrl}>
          {(a) => input('cloneUrl', a, { spellCheck: false })}
        </Field>

        <div className="form-grid">
          <Field
            id="r-visibility"
            label="공개 범위"
            help="비공개 저장소는 공개 화면과 공개 API에서 제외됩니다."
            error={errors.visibility}
          >
            {(a) => (
              <select {...a} value={form.visibility} onChange={(e) => set('visibility', e.target.value as Visibility)}>
                <option value="PRIVATE">비공개 (Private)</option>
                <option value="PUBLIC">공개 (Public)</option>
              </select>
            )}
          </Field>
          <div className="field">
            <span className="label">대표 저장소</span>
            <label className="checkbox">
              <input type="checkbox" checked={form.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} />
              이 저장소를 대표로 지정
            </label>
            <span className="help">프로젝트당 하나만 지정되며, 기존 대표는 자동으로 해제됩니다.</span>
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={props.onClose} disabled={busy}>
            취소
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '저장 중…' : isEdit ? '변경 내용 저장' : '저장소 등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
