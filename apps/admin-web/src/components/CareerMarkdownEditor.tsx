/**
 * 경력 마크다운 편집기: 경력 전체를 한 번에 붙여넣고 저장한다.
 * - 이력서 형식(2025 | 프로젝트, ㆍ근무기간, ≫ 업무)을 붙여넣으면 마크다운으로 자동 정리 (원문 그대로 넣기로 되돌릴 수 있음)
 * - 서식 버튼, 미리보기(데스크톱 나란히 / 모바일 탭), 저장 안 한 채 나가면 경고
 */
import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CAREER_MARKDOWN_MAX,
  careerTextToMarkdown,
  looksLikeCareerText,
  type CareerDto,
  type ProfileDto,
} from '@ppp/shared';
import { api, ApiRequestError } from '../api';
import { useToast } from './Toast';

/** 기존 개별 경력 → 마크다운 (처음 한 번 채워 주기용) */
function careersToMarkdown(items: CareerDto[]): string {
  return items
    .map((c) =>
      [
        `### ${c.company}`,
        '',
        `**${c.startDate.slice(0, 4)}**`,
        '',
        `- **직무**: ${c.position}`,
        `- **근무기간**: ${c.startDate} ~ ${c.endDate ?? '재직 중'}`,
        ...(c.description ? ['- **주요 업무 및 성과**', ...c.description.split('\n').filter(Boolean).map((l) => `  - ${l.trim()}`)] : []),
      ].join('\n'),
    )
    .join('\n\n');
}

export function CareerMarkdownEditor() {
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [prefilled, setPrefilled] = useState(false);
  const [lastPaste, setLastPaste] = useState<{ raw: string; before: string; start: number; end: number } | null>(null);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api<ProfileDto>('/admin/profile'), api<{ items: CareerDto[] }>('/admin/careers').catch(() => ({ items: [] }))])
      .then(([p, c]) => {
        if (p.careerMarkdown) {
          setText(p.careerMarkdown);
          setSaved(p.careerMarkdown);
        } else {
          const md = c.items.length ? careersToMarkdown(c.items) : '';
          setText(md);
          setSaved('');
          setPrefilled(!!md);
        }
      })
      .catch(() => {
        setText('');
        toast('경력을 불러오지 못했습니다.', 'error');
      });
  }, [toast]);

  const dirty = text !== null && text !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (text === null) return <div className="skeleton" style={{ height: 360 }} aria-busy="true" />;

  /** 선택 영역을 감싸거나 줄 앞에 기호를 붙인다 */
  const apply = (kind: 'h3' | 'bold' | 'list' | 'sub' | 'link') => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = text.slice(s, e);
    let insert = sel;
    if (kind === 'bold') insert = `**${sel || '굵은 글자'}**`;
    if (kind === 'link') insert = `[${sel || '링크 글자'}](https://)`;
    if (kind === 'h3' || kind === 'list' || kind === 'sub') {
      const prefix = kind === 'h3' ? '### ' : kind === 'list' ? '- ' : '  - ';
      const lineStart = text.lastIndexOf('\n', s - 1) + 1;
      const block = text.slice(lineStart, e) || '';
      const replaced = (block || '내용')
        .split('\n')
        .map((l) => prefix + l.replace(/^(#{1,6}\s|\s*-\s)/, ''))
        .join('\n');
      const next = text.slice(0, lineStart) + replaced + text.slice(e);
      setText(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(lineStart, lineStart + replaced.length);
      });
      return;
    }
    const next = text.slice(0, s) + insert + text.slice(e);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s, s + insert.length);
    });
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData('text');
    if (!looksLikeCareerText(raw)) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    const md = careerTextToMarkdown(raw);
    const next = text.slice(0, s) + md + text.slice(end);
    setLastPaste({ raw, before: text, start: s, end });
    setText(next);
    toast('경력 형식을 알아보고 보기 좋게 정리해 넣었습니다.');
  };

  const undoConversion = () => {
    if (!lastPaste) return;
    const { before, raw, start, end } = lastPaste;
    setText(before.slice(0, start) + raw + before.slice(end));
    setLastPaste(null);
  };

  const save = async () => {
    if (text.length > CAREER_MARKDOWN_MAX) {
      toast(`${CAREER_MARKDOWN_MAX.toLocaleString()}자 이하로 줄여 주세요.`, 'error');
      return;
    }
    setBusy(true);
    try {
      await api('/admin/profile/career', { method: 'PUT', body: JSON.stringify({ markdown: text }) });
      setSaved(text);
      setPrefilled(false);
      setLastPaste(null);
      toast('경력을 저장했습니다. 공개 화면에 반영됩니다.');
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '저장하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="career-md-title">
      <div className="panel-head">
        <h2 id="career-md-title">경력</h2>
        <div className="row-actions">
          {dirty && <span className="caption unsaved">저장하지 않은 변경 있음</span>}
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty}>
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      <p className="caption" style={{ marginBottom: 8 }}>
        경력 전체를 한 번에 붙여넣으세요. <b>2025 | 프로젝트명</b>, <b>ㆍ근무기간</b>, <b>≫ 업무</b> 형식은 자동으로 정리됩니다. 마크다운도 그대로 쓸 수 있습니다.
      </p>
      {prefilled && (
        <p className="notice">기존에 등록한 경력을 마크다운으로 바꿔 채워 두었습니다. 내용을 확인하고 저장하세요.</p>
      )}
      {lastPaste && (
        <p className="notice">
          붙여넣은 경력을 정리했습니다.{' '}
          <button type="button" className="btn btn-tertiary btn-sm" onClick={undoConversion}>
            원문 그대로 넣기
          </button>
        </p>
      )}

      <div className="md-tabs" role="tablist" aria-label="편집/미리보기">
        <button type="button" role="tab" aria-selected={tab === 'edit'} className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>
          편집
        </button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>
          미리보기
        </button>
      </div>

      <div className={`md-editor md-show-${tab}`}>
        <div className="md-pane md-edit">
          <div className="md-toolbar" role="toolbar" aria-label="서식">
            <button type="button" onClick={() => apply('h3')} title="프로젝트 제목">
              제목
            </button>
            <button type="button" onClick={() => apply('bold')} title="굵게">
              <b>B</b>
            </button>
            <button type="button" onClick={() => apply('list')} title="목록">
              • 목록
            </button>
            <button type="button" onClick={() => apply('sub')} title="하위 목록">
              ◦ 하위
            </button>
            <button type="button" onClick={() => apply('link')} title="링크">
              링크
            </button>
            <span className="caption md-count">
              {text.length.toLocaleString()} / {CAREER_MARKDOWN_MAX.toLocaleString()}자
            </span>
          </div>
          <label htmlFor="career-md" className="sr-only">
            경력 마크다운
          </label>
          <textarea
            id="career-md"
            ref={ref}
            className="md-textarea"
            value={text}
            spellCheck={false}
            placeholder={'여기에 경력을 붙여넣으세요.\n\n예)\n2025 | 프로젝트명(분야)\nㆍ근무기간: `25.03~`25.09\nㆍ기술스택: React, Node.js\nㆍ주요 업무 및 성과\n ≫ 화면 개발'}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (dirty) void save();
              }
            }}
          />
        </div>
        <div className="md-pane md-preview" aria-label="미리보기">
          {text.trim() ? (
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
            </div>
          ) : (
            <p className="muted">미리보기가 여기에 표시됩니다.</p>
          )}
        </div>
      </div>
      <p className="caption" style={{ marginTop: 8 }}>
        Ctrl+S 로도 저장됩니다. 내용을 모두 지우고 저장하면 공개 화면에서 경력 영역이 사라집니다.
      </p>
    </section>
  );
}
