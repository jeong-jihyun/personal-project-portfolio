/** ADM-03 프로젝트 등록/수정: 기본 정보, 키워드, 기간, 역할, 성과, 공개 여부. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  projectCreateSchema,
  type ProjectDetailDto,
  type ProjectStatus,
  type SkillDto,
  type Visibility,
} from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { KeywordInput } from '../components/KeywordInput';
import { useToast } from '../components/Toast';
import { ErrorState, Field } from '../components/ui';

interface FormState {
  title: string;
  projectUrl: string;
  summary: string;
  problem: string;
  description: string;
  status: ProjectStatus;
  visibility: Visibility;
  startDate: string;
  endDate: string;
  role: string;
  outcome: string;
  keywords: string[];
}

const EMPTY: FormState = {
  title: '',
  projectUrl: '',
  summary: '',
  problem: '',
  description: '',
  status: 'PLANNED',
  visibility: 'PRIVATE',
  startDate: '',
  endDate: '',
  role: '',
  outcome: '',
  keywords: [],
};

function fromDetail(p: ProjectDetailDto): FormState {
  return {
    title: p.title,
    projectUrl: p.projectUrl ?? '',
    summary: p.summary ?? '',
    problem: p.problem ?? '',
    description: p.description ?? '',
    status: p.status,
    visibility: p.visibility,
    startDate: p.startDate ?? '',
    endDate: p.endDate ?? '',
    role: p.role ?? '',
    outcome: p.outcome ?? '',
    keywords: p.skills.map((s) => s.name),
  };
}

export function ProjectFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<FormState | null>(isEdit ? null : EMPTY);
  const [skills, setSkills] = useState<SkillDto[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: SkillDto[] }>('/admin/skills')
      .then((r) => setSkills(r.items))
      .catch(() => setSkills([]));
    if (isEdit) {
      api<ProjectDetailDto>(`/admin/projects/${id}`)
        .then((p) => setForm(fromDetail(p)))
        .catch((e) => setLoadError(e instanceof ApiRequestError ? e.message : '불러오지 못했습니다.'));
    }
  }, [id, isEdit]);

  if (loadError) return <ErrorState message={loadError} />;
  if (!form) return <div className="skeleton" style={{ height: 400 }} aria-busy="true" />;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm({ ...form, [key]: value });
    if (errors[key]) setErrors({ ...errors, [key]: '' });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = projectCreateSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      document.getElementById(`f-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      // 수정 시 빈 값은 ''로 보내 서버가 null(삭제)로 처리하게 한다.
      const saved = await api<ProjectDetailDto>(isEdit ? `/admin/projects/${id}` : '/admin/projects', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      toast(isEdit ? '프로젝트가 수정되었습니다.' : '프로젝트가 등록되었습니다.');
      navigate(`/projects/${saved.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && Array.isArray(err.body.details)) {
        const next: Record<string, string> = {};
        for (const d of err.body.details as { path: string; message: string }[]) next[d.path.split('.')[0]!] ??= d.message;
        setErrors(next);
      }
      toast(err instanceof ApiRequestError ? err.message : '저장하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const text = (key: keyof FormState, a11y: object, extra: object = {}) => (
    <input {...a11y} {...extra} value={form[key] as string} onChange={(e) => set(key, e.target.value as never)} />
  );
  const area = (key: keyof FormState, a11y: object, rows = 4) => (
    <textarea {...a11y} rows={rows} value={form[key] as string} onChange={(e) => set(key, e.target.value as never)} />
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADM-03</div>
          <h1>{isEdit ? '프로젝트 수정' : '프로젝트 등록'}</h1>
        </div>
      </div>

      <form className="form-layout" onSubmit={onSubmit} noValidate>
        <section className="panel">
          <h2 className="section-title">기본 정보</h2>
          <Field id="f-title" label="프로젝트명" required error={errors.title}>
            {(a) => text('title', a, { maxLength: 120, autoFocus: !isEdit })}
          </Field>
          <Field id="f-projectUrl" label="프로젝트 URL" help="서비스·데모 주소 (선택). 공개 화면에서 바로가기 링크로 보입니다." error={errors.projectUrl}>
            {(a) => text('projectUrl', a, { type: 'url', inputMode: 'url', maxLength: 2048, placeholder: 'https://my-service.com', spellCheck: false })}
          </Field>
          <Field id="f-summary" label="요약" help="목적·문제·결과를 한두 문장으로 (300자)" error={errors.summary}>
            {(a) => area('summary', a, 2)}
          </Field>
          <KeywordInput
            id="f-keywords"
            value={form.keywords}
            onChange={(next) => set('keywords', next)}
            suggestions={skills.map((s) => s.name)}
            error={errors.keywords}
          />
          <div className="form-grid">
            <Field id="f-status" label="진행 상태" error={errors.status}>
              {(a) => (
                <select {...a} value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field id="f-visibility" label="공개 여부" help="게시(외부 노출)는 9단계 포트폴리오 설정에서 따로 켭니다." error={errors.visibility}>
              {(a) => (
                <select {...a} value={form.visibility} onChange={(e) => set('visibility', e.target.value as Visibility)}>
                  <option value="PRIVATE">비공개</option>
                  <option value="PUBLIC">공개</option>
                </select>
              )}
            </Field>
            <Field id="f-startDate" label="시작일" error={errors.startDate}>
              {(a) => text('startDate', a, { type: 'date' })}
            </Field>
            <Field id="f-endDate" label="종료일" help="진행 중이면 비워 두세요." error={errors.endDate}>
              {(a) => text('endDate', a, { type: 'date', min: form.startDate || undefined })}
            </Field>
          </div>
        </section>

        <section className="panel">
          <h2 className="section-title">내용 (공개 상세 순서: 문제 → 역할 → 수행 → 성과)</h2>
          <Field id="f-problem" label="문제 / 목표" error={errors.problem}>
            {(a) => area('problem', a)}
          </Field>
          <Field id="f-role" label="담당 역할" error={errors.role}>
            {(a) => text('role', a, { maxLength: 200, placeholder: '예: 기획·설계·개발' })}
          </Field>
          <Field id="f-description" label="수행 내용" error={errors.description}>
            {(a) => area('description', a, 6)}
          </Field>
          <Field id="f-outcome" label="성과 및 결과" help="근거가 있는 수치만 적고, 추정치를 사실처럼 쓰지 않습니다." error={errors.outcome}>
            {(a) => area('outcome', a)}
          </Field>
        </section>

        <div className="form-actions">
          <Link to={isEdit ? `/projects/${id}` : '/projects'} className="btn btn-secondary">
            취소
          </Link>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? '저장 중…' : isEdit ? '변경 내용 저장' : '프로젝트 등록'}
          </button>
        </div>
      </form>
    </>
  );
}
