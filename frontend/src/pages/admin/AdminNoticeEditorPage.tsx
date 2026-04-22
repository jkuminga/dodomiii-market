import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { AdminFloatingSubmitButton } from '../../components/admin/AdminFloatingSubmitButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminLayoutContext, formatAdminDateTime } from './adminUtils';
import { AdminNoticeDetail, NoticeContentBlock, apiClient } from '../../lib/api';

type TextBlockDraft = {
  key: string;
  type: 'text';
  text: string;
};

type ImageBlockDraft = {
  key: string;
  type: 'image';
  imageUrl: string;
  publicId: string;
  alt: string;
  caption: string;
  isUploading: boolean;
  uploadError: string;
};

type NoticeBlockDraft = TextBlockDraft | ImageBlockDraft;

type NoticeFormState = {
  title: string;
  summary: string;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string;
  blocks: NoticeBlockDraft[];
};

const FLOATING_SUBMIT_SUCCESS_MS = 700;

let blockSequence = 0;

function nextBlockKey() {
  blockSequence += 1;
  return `notice-block-${blockSequence}`;
}

function createTextBlock(text = ''): TextBlockDraft {
  return {
    key: nextBlockKey(),
    type: 'text',
    text,
  };
}

function createImageBlock(): ImageBlockDraft {
  return {
    key: nextBlockKey(),
    type: 'image',
    imageUrl: '',
    publicId: '',
    alt: '',
    caption: '',
    isUploading: false,
    uploadError: '',
  };
}

function createEmptyForm(): NoticeFormState {
  return {
    title: '',
    summary: '',
    isPinned: false,
    isPublished: false,
    publishedAt: '',
    blocks: [],
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toDatetimeLocalValue(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60 * 1000);
  return normalized.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function blocksFromNotice(notice: AdminNoticeDetail): NoticeBlockDraft[] {
  if (!notice.contentJson.blocks.length) {
    return [];
  }

  return notice.contentJson.blocks.map((block) =>
    block.type === 'text'
      ? createTextBlock(block.text)
      : {
          ...createImageBlock(),
          imageUrl: block.imageUrl,
          publicId: block.publicId ?? '',
          alt: block.alt ?? '',
          caption: block.caption ?? '',
        },
  );
}

function formFromNotice(notice: AdminNoticeDetail): NoticeFormState {
  return {
    title: notice.title,
    summary: notice.summary ?? '',
    isPinned: notice.isPinned,
    isPublished: notice.isPublished,
    publishedAt: toDatetimeLocalValue(notice.publishedAt),
    blocks: blocksFromNotice(notice),
  };
}

function serializeForm(form: NoticeFormState): string {
  return JSON.stringify({
    title: form.title,
    summary: form.summary,
    isPinned: form.isPinned,
    isPublished: form.isPublished,
    publishedAt: form.publishedAt,
    blocks: form.blocks.map((block) =>
      block.type === 'text'
        ? { type: 'text', text: block.text }
        : { type: 'image', imageUrl: block.imageUrl, publicId: block.publicId, alt: block.alt, caption: block.caption },
    ),
  });
}

function buildPayload(form: NoticeFormState) {
  const title = form.title.trim();

  if (!title) {
    throw new Error('공지 제목을 입력해주세요.');
  }

  if (form.blocks.length === 0) {
    throw new Error('본문 블록을 하나 이상 추가해주세요.');
  }

  const blocks: NoticeContentBlock[] = form.blocks.map((block) => {
    if (block.type === 'text') {
      const text = block.text.trim();

      if (!text) {
        throw new Error('텍스트 블록 내용을 입력해주세요.');
      }

      return {
        type: 'text',
        text,
      };
    }

    if (block.isUploading) {
      throw new Error('이미지 업로드가 끝난 뒤 저장해주세요.');
    }

    if (!block.imageUrl.trim()) {
      throw new Error('이미지 블록에 이미지를 첨부해주세요.');
    }

    return {
      type: 'image',
      imageUrl: block.imageUrl.trim(),
      publicId: block.publicId.trim() || null,
      alt: block.alt.trim() || null,
      caption: block.caption.trim() || null,
    };
  });

  return {
    title,
    summary: form.summary.trim() || null,
    isPinned: form.isPinned,
    isPublished: form.isPublished,
    publishedAt: form.isPublished ? toIsoDateTime(form.publishedAt) : null,
    contentJson: {
      version: 1,
      blocks,
    },
  };
}

export function AdminNoticeEditorPage() {
  const { noticeId } = useParams<{ noticeId: string }>();
  const navigate = useNavigate();
  const { showToast } = useOutletContext<AdminLayoutContext>();

  const isCreateMode = !noticeId;

  const [notice, setNotice] = useState<AdminNoticeDetail | null>(null);
  const [form, setForm] = useState<NoticeFormState>(createEmptyForm());
  const [initialSignature, setInitialSignature] = useState(() => serializeForm(createEmptyForm()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPage = async () => {
    setLoading(true);
    setError('');

    try {
      if (isCreateMode) {
        const nextForm = createEmptyForm();
        setNotice(null);
        setForm(nextForm);
        setInitialSignature(serializeForm(nextForm));
      } else if (noticeId) {
        const result = await apiClient.getAdminNoticeById(noticeId);
        const nextForm = formFromNotice(result);
        setNotice(result);
        setForm(nextForm);
        setInitialSignature(serializeForm(nextForm));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '공지사항 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [isCreateMode, noticeId]);

  const hasUnsavedChanges = useMemo(() => serializeForm(form) !== initialSignature, [form, initialSignature]);
  const hasUploadingBlocks = useMemo(
    () => form.blocks.some((block) => block.type === 'image' && block.isUploading),
    [form.blocks],
  );

  const updateForm = <Key extends keyof NoticeFormState>(key: Key, value: NoticeFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const updateBlock = (key: string, patch: Partial<NoticeBlockDraft>) => {
    setForm((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.key === key ? ({ ...block, ...patch } as NoticeBlockDraft) : block)),
    }));
    setError('');
  };

  const moveBlock = (key: string, direction: -1 | 1) => {
    setForm((current) => {
      const index = current.blocks.findIndex((block) => block.key === key);

      if (index < 0) {
        return current;
      }

      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.blocks.length) {
        return current;
      }

      const nextBlocks = [...current.blocks];
      const [target] = nextBlocks.splice(index, 1);
      nextBlocks.splice(nextIndex, 0, target);

      return {
        ...current,
        blocks: nextBlocks,
      };
    });
  };

  const removeBlock = (key: string) => {
    setForm((current) => {
      return {
        ...current,
        blocks: current.blocks.filter((block) => block.key !== key),
      };
    });
  };

  const addTextBlock = () => {
    setForm((current) => ({
      ...current,
      blocks: [...current.blocks, createTextBlock()],
    }));
  };

  const addImageBlock = () => {
    setForm((current) => ({
      ...current,
      blocks: [...current.blocks, createImageBlock()],
    }));
  };

  const buildUploadFolderSuffix = () => {
    if (noticeId) {
      return `notice-${noticeId}`;
    }

    const normalizedTitle = form.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    return normalizedTitle ? `new-notice-${normalizedTitle}` : 'new-notice';
  };

  const uploadNoticeImageToCloudinary = async (file: File) => {
    const signed = await apiClient.signAdminUpload({
      usage: 'NOTICE_CONTENT',
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      folderSuffix: buildUploadFolderSuffix(),
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signed.apiKey);
    formData.append('timestamp', String(signed.timestamp));
    formData.append('signature', signed.signature);
    formData.append('folder', signed.folder);
    formData.append('public_id', signed.publicId);

    const uploadResponse = await fetch(signed.uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const uploadResult = (await uploadResponse.json().catch(() => ({}))) as {
      public_id?: string;
      version?: number;
      secure_url?: string;
      signature?: string;
      resource_type?: 'image';
      format?: string;
      width?: number;
      height?: number;
      bytes?: number;
      error?: {
        message?: string;
      };
    };

    if (!uploadResponse.ok || !uploadResult.public_id || !uploadResult.version || !uploadResult.secure_url) {
      throw new Error(uploadResult.error?.message ?? 'Cloudinary 업로드에 실패했습니다.');
    }

    const finalized = await apiClient.finalizeAdminUpload({
      publicId: uploadResult.public_id,
      version: uploadResult.version,
      secureUrl: uploadResult.secure_url,
      signature: uploadResult.signature,
      resourceType: uploadResult.resource_type,
      format: uploadResult.format,
      width: uploadResult.width,
      height: uploadResult.height,
      bytes: uploadResult.bytes,
    });

    return finalized;
  };

  const onSelectImageFile = async (blockKey: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      return;
    }

    const currentBlock = form.blocks.find((block) => block.key === blockKey && block.type === 'image');
    const previousPublicId = currentBlock && currentBlock.type === 'image' ? currentBlock.publicId.trim() : '';

    updateBlock(blockKey, { isUploading: true, uploadError: '' });

    try {
      const asset = await uploadNoticeImageToCloudinary(file);
      updateBlock(blockKey, {
        imageUrl: asset.secureUrl,
        publicId: asset.publicId,
        isUploading: false,
        uploadError: '',
      });

      if (previousPublicId && previousPublicId !== asset.publicId) {
        void apiClient.deleteAdminUpload({ publicId: previousPublicId }).catch((caught) => {
          console.error('Failed to delete replaced Cloudinary asset', caught);
        });
      }

      showToast(`이미지 업로드를 완료했습니다. (${formatFileSize(file.size)})`);
    } catch (caught) {
      updateBlock(blockKey, {
        isUploading: false,
        uploadError: caught instanceof Error ? caught.message : '이미지 업로드에 실패했습니다.',
      });
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);
    setSubmitSuccess(false);
    setError('');

    try {
      const payload = buildPayload(form);

      if (isCreateMode) {
        const created = await apiClient.createAdminNotice(payload);
        showToast('공지사항을 등록했습니다.');
        setSubmitSuccess(true);
        setNotice(created);
        navigate(`/admin/notices/${created.id}`, { replace: true });
      } else if (noticeId) {
        const updated = await apiClient.updateAdminNotice(noticeId, payload);
        const nextForm = formFromNotice(updated);
        setNotice(updated);
        setForm(nextForm);
        setInitialSignature(serializeForm(nextForm));
        setSubmitSuccess(true);
        showToast('공지사항을 저장했습니다.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '공지사항 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
      window.setTimeout(() => setSubmitSuccess(false), FLOATING_SUBMIT_SUCCESS_MS);
    }
  };

  const onDelete = async () => {
    if (!notice || !noticeId) {
      return;
    }

    const confirmed = window.confirm(`'${notice.title}' 공지사항을 삭제하시겠습니까?`);

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await apiClient.deleteAdminNotice(noticeId);
      showToast('공지사항을 삭제했습니다.');
      navigate('/admin/notices', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '공지사항 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isCreateMode && !loading && !notice && !error) {
    return <Navigate to="/admin/notices" replace />;
  }

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Notice Editor</p>
          <h2 className="section-title admin-section-title">{isCreateMode ? '공지사항 등록' : '공지사항 수정'}</h2>
        </div>

        <div className="inline-actions">
          <Link className="button button-secondary" to="/admin/notices">
            목록
          </Link>
          {!isCreateMode ? (
            <button className="button button-ghost" type="button" onClick={() => void onDelete()} disabled={deleting}>
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          ) : null}
        </div>
      </section>

      {loading ? <LoadingScreen mode="page" title="공지사항 편집기 로딩 중" message="작성 정보를 불러오고 있습니다." /> : null}

      {!loading ? (
        <form className="admin-two-column admin-notice-layout" onSubmit={onSubmit}>
          <AdminFloatingSubmitButton
            busy={submitting}
            busyLabel="저장 중..."
            disabled={submitting || deleting || hasUploadingBlocks || !hasUnsavedChanges}
            label={isCreateMode ? '공지 등록' : '변경 저장'}
            success={submitSuccess}
          />

          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Content</p>
                <h3 className="section-subtitle">공지 작성</h3>
              </div>
            </div>

            {error ? (
              <p className="feedback-copy is-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="admin-field-grid">
              <label className="field admin-field-span-2">
                <span>제목</span>
                <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="공지 제목 입력" />
              </label>

              <label className="field admin-field-span-2">
                <span>요약</span>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(event) => updateForm('summary', event.target.value)}
                  placeholder="목록에서 보여줄 짧은 설명"
                />
              </label>

              <label className="admin-check-field">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(event) => updateForm('isPinned', event.target.checked)}
                />
                <span>상단 고정 여부</span>
              </label>

              <label className="admin-check-field">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(event) => updateForm('isPublished', event.target.checked)}
                />
                <span>공개 여부</span>
              </label>

            </div>

            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Blocks</p>
                <h3 className="section-subtitle">본문 블록</h3>
              </div>
              <div className="inline-actions">
                <button className="button button-secondary" type="button" onClick={addTextBlock}>
                  텍스트 추가
                </button>
                <button className="button button-secondary" type="button" onClick={addImageBlock}>
                  이미지 추가
                </button>
              </div>
            </div>

            <div className="admin-notice-block-list">
              {form.blocks.length === 0 ? (
                <section className="admin-empty-state">
                  <p className="section-kicker">Empty</p>
                  <h4 className="section-subtitle">본문 블록이 비어있습니다.</h4>
                </section>
              ) : null}

              {form.blocks.map((block, index) => (
                <article className="admin-subcard admin-notice-block-card" key={block.key}>
                  <div className="admin-section-head">
                    <div>
                      <p className="section-kicker">{block.type === 'text' ? 'Text' : 'Image'}</p>
                      <h4 className="section-subtitle">블록 {index + 1}</h4>
                    </div>
                    <div className="inline-actions">
                      <button className="button button-ghost" type="button" onClick={() => moveBlock(block.key, -1)} disabled={index === 0}>
                        위로
                      </button>
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => moveBlock(block.key, 1)}
                        disabled={index === form.blocks.length - 1}
                      >
                        아래로
                      </button>
                      <button className="button button-ghost" type="button" onClick={() => removeBlock(block.key)}>
                        삭제
                      </button>
                    </div>
                  </div>

                  {block.type === 'text' ? (
                    <label className="field">
                      <span>텍스트 내용</span>
                      <textarea
                        rows={6}
                        value={block.text}
                        onChange={(event) => updateBlock(block.key, { text: event.target.value })}
                        placeholder="안내 문구를 입력하세요"
                      />
                    </label>
                  ) : (
                    <div className="admin-card-stack">
                      <label className="admin-notice-image-picker">
                        <span className="section-kicker">Image Asset</span>
                        <strong>{block.imageUrl ? '다른 이미지로 교체' : '이미지 선택'}</strong>
                        <span className="admin-inline-note">파일 선택 즉시 업로드가 시작됩니다.</span>
                        <input type="file" accept="image/*" onChange={(event) => void onSelectImageFile(block.key, event)} />
                      </label>

                      {block.isUploading ? <p className="feedback-copy">이미지 업로드 중입니다...</p> : null}
                      {block.uploadError ? (
                        <p className="feedback-copy is-error" role="alert">
                          {block.uploadError}
                        </p>
                      ) : null}

                      {block.imageUrl ? (
                        <div className="admin-notice-image-preview">
                          <img src={block.imageUrl} alt={block.alt || '공지 이미지 미리보기'} />
                        </div>
                      ) : (
                        <div className="admin-notice-image-empty">업로드된 이미지가 없습니다.</div>
                      )}

                      <label className="field">
                        <span>대체 텍스트</span>
                        <input value={block.alt} onChange={(event) => updateBlock(block.key, { alt: event.target.value })} />
                      </label>

                      <label className="field">
                        <span>캡션(이미지 하단에 출력되는 이미지 설명용 텍스트)</span>
                        <input value={block.caption} onChange={(event) => updateBlock(block.key, { caption: event.target.value })} />
                      </label>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <aside className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Preview</p>
                <h3 className="section-subtitle">미리보기</h3>
              </div>
            </div>

            <div className="admin-notice-preview-meta">
              <strong>{form.title.trim() || '제목 미입력'}</strong>
              <div className="admin-pill-row">
                <span className={`status-pill ${form.isPinned ? '' : 'is-muted'}`}>{form.isPinned ? '상단 고정' : '일반 공지'}</span>
                <span className={`status-pill ${form.isPublished ? '' : 'is-muted'}`}>{form.isPublished ? '공개' : '비공개'}</span>
              </div>
              {notice ? <span>마지막 수정 {formatAdminDateTime(notice.updatedAt)}</span> : null}
            </div>

            <div className="admin-notice-preview-body">
              {form.summary.trim() ? <p className="admin-notice-preview-summary">{form.summary.trim()}</p> : null}
              {form.blocks.map((block) =>
                block.type === 'text' ? (
                  <p className="admin-notice-preview-text" key={block.key}>
                    {block.text.trim() || '텍스트 미입력'}
                  </p>
                ) : (
                  <figure className="admin-notice-preview-image" key={block.key}>
                    {block.imageUrl ? <img src={block.imageUrl} alt={block.alt || '공지 이미지'} /> : <div className="admin-notice-image-empty">이미지 없음</div>}
                    {block.caption.trim() ? <figcaption>{block.caption.trim()}</figcaption> : null}
                  </figure>
                ),
              )}
            </div>

            <div className="admin-inline-note">
              저장 전 확인:
              {hasUploadingBlocks ? ' 이미지 업로드가 진행 중입니다.' : ' 모든 이미지가 업로드 완료되었습니다.'}
            </div>
          </aside>
        </form>
      ) : null}
    </section>
  );
}
