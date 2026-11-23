/**
 * 프로젝트 스크린샷 관리 (데스크톱·모바일).
 * - 데스크톱: 파일 선택, 끌어다 놓기, Ctrl+V 붙여넣기(캡처 화면) / 모바일: 사진 보관함 선택 또는 카메라 촬영
 * - 첫 번째 이미지가 대표 이미지(프로젝트 목록 썸네일)
 */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { SCREENSHOT_MAX_PER_PROJECT, type AssetDto } from '@ppp/shared';
import { ApiRequestError } from '../api';
import { ImagePrepareError, prepareImage } from '../image';
import { useToast } from './Toast';
import { ConfirmDialog, VisibilityBadge } from './ui';

async function uploadFile(projectId: string, file: File): Promise<AssetDto> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`/api/v1/admin/projects/${projectId}/screenshots`, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(res.status, body ?? { code: 'HTTP_ERROR', message: `업로드 실패 (${res.status})`, traceId: '-' });
  }
  return body as AssetDto;
}

async function json<T>(url: string, method: string, data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, body ?? { code: 'HTTP_ERROR', message: '요청 실패', traceId: '-' });
  return body as T;
}

export function ScreenshotsPanel({ projectId, assets, onChanged }: { projectId: string; assets: AssetDto[]; onChanged(): void }) {
  const toast = useToast();
  const images = assets.filter((a) => a.type === 'IMAGE');
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewing, setViewing] = useState<AssetDto | null>(null);
  const [deleting, setDeleting] = useState<AssetDto | null>(null);
  const [busy, setBusy] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const remaining = SCREENSHOT_MAX_PER_PROJECT - images.length;

  const handleFiles = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter((f) => !f.type || f.type.startsWith('image/'));
    if (files.length === 0) return;
    if (files.length > remaining) {
      toast(`스크린샷은 프로젝트당 ${SCREENSHOT_MAX_PER_PROJECT}장까지입니다. (${remaining}장 더 가능)`, 'error');
      files.splice(remaining);
      if (files.length === 0) return;
    }
    setUploading({ done: 0, total: files.length });
    let ok = 0;
    for (const [i, f] of files.entries()) {
      try {
        await uploadFile(projectId, await prepareImage(f));
        ok++;
      } catch (e) {
        toast(e instanceof ApiRequestError || e instanceof ImagePrepareError ? e.message : `'${f.name}' 업로드 실패`, 'error');
      }
      setUploading({ done: i + 1, total: files.length });
    }
    setUploading(null);
    if (ok) toast(`스크린샷 ${ok}장을 올렸습니다.`);
    onChanged();
  };

  // Ctrl+V: 클립보드의 캡처 이미지(Win+Shift+S, Print Screen 등)를 바로 올린다. 글자 입력칸에 붙여넣을 때는 무시.
  const handleFilesRef = useRef(handleFiles);
  handleFilesRef.current = handleFiles;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f)
        .map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `붙여넣은 캡처 ${new Date().toLocaleString('ko-KR')}${i ? ` (${i + 1})` : ''}.png`, { type: f.type })));
      if (files.length === 0) return;
      e.preventDefault();
      void handleFilesRef.current(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  };

  const makeCover = async (img: AssetDto) => {
    try {
      await json(`/api/v1/admin/projects/${projectId}/screenshots/order`, 'PATCH', { assetIds: [img.id] });
      toast('대표 이미지로 지정했습니다.');
      onChanged();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '변경하지 못했습니다.', 'error');
    }
  };

  const toggleVisibility = async (img: AssetDto) => {
    try {
      await json(`/api/v1/admin/screenshots/${img.id}`, 'PATCH', { visibility: img.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' });
      onChanged();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '변경하지 못했습니다.', 'error');
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await json(`/api/v1/admin/screenshots/${deleting.id}`, 'DELETE');
      toast('스크린샷을 삭제했습니다.');
      setDeleting(null);
      setViewing(null);
      onChanged();
    } catch (e) {
      toast(e instanceof ApiRequestError ? e.message : '삭제하지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="shots-title">
      <div className="panel-head">
        <h2 id="shots-title">스크린샷 ({images.length})</h2>
        <span className="caption">첫 번째 이미지 = 대표</span>
      </div>

      <div
        className={`dropzone${dragOver ? ' dropzone-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {uploading ? (
          <p role="status" className="dropzone-status">
            올리는 중… {uploading.done} / {uploading.total}
          </p>
        ) : (
          <>
            <div className="dropzone-actions">
              <button type="button" className="btn btn-primary" onClick={() => pickRef.current?.click()} disabled={remaining <= 0}>
                ＋ 이미지 선택
              </button>
              <button type="button" className="btn btn-secondary only-touch" onClick={() => cameraRef.current?.click()} disabled={remaining <= 0}>
                📷 촬영
              </button>
            </div>
            <p className="caption">
              <span className="only-pointer">
                캡처 후 <kbd>Ctrl</kbd>+<kbd>V</kbd>로 붙여넣기 또는 여기로 끌어다 놓기 ·{' '}
              </span>
              PNG·JPG·WebP·GIF, 여러 장 가능 · 자동으로 크기를 줄여 올립니다
            </p>
          </>
        )}
        <input
          ref={pickRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {images.length > 0 && (
        <ul className="shots">
          {images.map((img, i) => (
            <li key={img.id} className="shot">
              <button type="button" className="shot-thumb" onClick={() => setViewing(img)} aria-label={`${img.title} 크게 보기`}>
                <img src={img.url} alt={img.title} loading="lazy" />
                {i === 0 && <span className="badge badge-featured shot-cover">★ 대표</span>}
              </button>
              <div className="shot-meta">
                <span className="shot-title" title={img.title}>
                  {img.title}
                </span>
                <VisibilityBadge visibility={img.visibility} />
              </div>
              <div className="shot-actions">
                {i > 0 && (
                  <button type="button" className="btn btn-tertiary btn-sm" onClick={() => makeCover(img)}>
                    대표로
                  </button>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleVisibility(img)}>
                  {img.visibility === 'PUBLIC' ? '비공개로' : '공개로'}
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleting(img)} aria-label={`${img.title} 삭제`}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewing && <Lightbox image={viewing} onClose={() => setViewing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="스크린샷을 삭제할까요?"
          confirmLabel="삭제"
          danger
          busy={busy}
          onConfirm={doDelete}
          onCancel={() => setDeleting(null)}
        >
          <p>
            <b>{deleting.title}</b> 이미지를 삭제합니다. 저장된 파일도 함께 지워지며 되돌릴 수 없습니다.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

function Lightbox({ image, onClose }: { image: AssetDto; onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={image.title} onClick={onClose}>
      <img src={image.url} alt={image.title} onClick={(e) => e.stopPropagation()} />
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span>
          {image.title}
          {image.width && image.height ? ` · ${image.width}×${image.height}` : ''}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} autoFocus>
          닫기
        </button>
      </div>
    </div>
  );
}
