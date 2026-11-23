/** 공통 UI: 상태 배지(색상+텍스트+아이콘), 확인 대화상자, 페이지네이션, 필드. */
import { useEffect, useRef, type ReactNode } from 'react';
import {
  PROJECT_STATUS_LABEL,
  PUBLICATION_STATUS_LABEL,
  VISIBILITY_LABEL,
  type ProjectStatus,
  type PublicationStatus,
  type Visibility,
} from '@ppp/shared';

const STATUS_ICON: Record<ProjectStatus, string> = {
  PLANNED: '○',
  IN_PROGRESS: '◐',
  COMPLETED: '●',
  ON_HOLD: '‖',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span>
      {PROJECT_STATUS_LABEL[status]}
    </span>
  );
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <span className={`badge badge-${visibility.toLowerCase()}`}>
      <span aria-hidden="true">{visibility === 'PUBLIC' ? '◉' : '◌'}</span>
      {VISIBILITY_LABEL[visibility]}
    </span>
  );
}

export function PublicationBadge({ status }: { status: PublicationStatus }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      <span aria-hidden="true">{status === 'PUBLISHED' ? '↗' : '–'}</span>
      {PUBLICATION_STATUS_LABEL[status]}
    </span>
  );
}

export function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '기간 미정';
  return `${start ?? '?'} ~ ${end ?? '진행 중'}`;
}

export function ConfirmDialog(props: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onCancel()}>
      <div className="dialog dialog-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="dialog-head">
          <h2 id="confirm-title">{props.title}</h2>
        </div>
        <div>{props.children}</div>
        <div className="dialog-actions">
          <button ref={cancelRef} className="btn btn-secondary" onClick={props.onCancel} disabled={props.busy}>
            취소
          </button>
          <button className={`btn ${props.danger ? 'btn-danger' : 'btn-primary'}`} onClick={props.onConfirm} disabled={props.busy}>
            {props.busy ? '처리 중…' : props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage(p: number): void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="페이지 이동">
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹ 이전
      </button>
      <span className="caption">
        {page} / {pages} 페이지 · 총 {total}개
      </span>
      <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        다음 ›
      </button>
    </nav>
  );
}

export function Field(props: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: (a11y: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const describedBy = [props.help && `${props.id}-help`, props.error && `${props.id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={props.id}>
        {props.label}
        {props.required && <span className="required">*</span>}
      </label>
      {props.children({ id: props.id, 'aria-invalid': !!props.error, 'aria-describedby': describedBy })}
      {props.help && (
        <span id={`${props.id}-help`} className="help">
          {props.help}
        </span>
      )}
      {props.error && (
        <span id={`${props.id}-error`} className="error" role="alert">
          {props.error}
        </span>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <h3>불러오지 못했습니다</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
