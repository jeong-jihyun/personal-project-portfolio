/**
 * 키워드 직접 입력: "#TypeScript", "React" 를 입력하고 Enter 또는 쉼표로 추가한다.
 * - 빈 입력칸에서 Backspace → 마지막 키워드 삭제
 * - 붙여넣기 "#A #B, C" → 여러 개 한 번에 추가
 * - 이전에 쓴 키워드를 입력 중 추천
 */
import { useId, useMemo, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { dedupeKeywords, MAX_KEYWORD_LENGTH, MAX_KEYWORDS, normalizeKeyword } from '@ppp/shared';

export function KeywordInput(props: {
  id: string;
  value: string[];
  onChange(next: string[]): void;
  suggestions?: string[];
  error?: string;
}) {
  const { value, onChange } = props;
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const helpId = useId();

  const add = (raw: string[]) => {
    const incoming = raw.map(normalizeKeyword).filter(Boolean);
    if (incoming.length === 0) return;
    const tooLong = incoming.find((k) => k.length > MAX_KEYWORD_LENGTH || /[<>]/.test(k));
    if (tooLong) {
      setHint(`'${tooLong.slice(0, 20)}…' — ${MAX_KEYWORD_LENGTH}자 이하, < > 없이 입력하세요.`);
      return;
    }
    const next = dedupeKeywords([...value, ...incoming]);
    if (next.length > MAX_KEYWORDS) {
      setHint(`키워드는 ${MAX_KEYWORDS}개까지 넣을 수 있습니다.`);
      return;
    }
    if (next.length === value.length) setHint('이미 추가한 키워드입니다.');
    else setHint(null);
    onChange(next);
    setDraft('');
  };

  const remove = (k: string) => onChange(value.filter((x) => x !== k));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter 무시
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add([draft]);
    } else if (e.key === 'Backspace' && draft === '' && value.length) {
      remove(value[value.length - 1]!);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[,#\n]/.test(text)) return;
    e.preventDefault();
    add(text.split(/[,\n]|(?=#)/));
  };

  const matches = useMemo(() => {
    const q = normalizeKeyword(draft).toLowerCase();
    const taken = new Set(value.map((v) => v.toLowerCase()));
    return (props.suggestions ?? [])
      .filter((s) => !taken.has(s.toLowerCase()) && (!q || s.toLowerCase().includes(q)))
      .slice(0, 10);
  }, [draft, value, props.suggestions]);

  return (
    <div className="field">
      <label htmlFor={props.id}>키워드</label>
      <div className={`keyword-box${props.error ? ' has-error' : ''}`} onClick={() => document.getElementById(props.id)?.focus()}>
        {value.map((k) => (
          <span key={k} className="keyword">
            #{k}
            <button type="button" aria-label={`${k} 키워드 삭제`} onClick={() => remove(k)}>
              ✕
            </button>
          </span>
        ))}
        <input
          id={props.id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) add([v.slice(0, -1)]);
            else setDraft(v);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => draft.trim() && add([draft])}
          placeholder={value.length ? '' : '#TypeScript #React #NestJS'}
          aria-describedby={helpId}
          aria-invalid={!!props.error}
          maxLength={MAX_KEYWORD_LENGTH + 2}
          autoComplete="off"
        />
      </div>
      <span id={helpId} className="help">
        입력 후 Enter 또는 쉼표(,)로 추가 · # 은 붙여도 되고 안 붙여도 됩니다 · 최대 {MAX_KEYWORDS}개 ({value.length}/{MAX_KEYWORDS})
      </span>
      {(hint || props.error) && (
        <span className="error" role="alert">
          {props.error || hint}
        </span>
      )}
      {matches.length > 0 && (
        <div className="keyword-suggest" aria-label="이전에 쓴 키워드">
          <span className="caption">{draft ? '추천' : '이전에 쓴 키워드'}</span>
          {matches.map((s) => (
            <button key={s} type="button" className="keyword keyword-option" onClick={() => add([s])}>
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
