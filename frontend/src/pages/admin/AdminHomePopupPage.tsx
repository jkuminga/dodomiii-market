import { FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminHomePopup, apiClient } from '../../lib/api';
import { AdminLayoutContext, formatAdminDateTime } from './adminUtils';

type PopupFormState = {
  popupId?: number;
  title: string;
  imageUrl: string;
  linkUrl: string;
  isActive: boolean;
};

function toFormState(popup: AdminHomePopup | null): PopupFormState {
  if (popup === null) {
    return {
      title: '',
      imageUrl: '',
      linkUrl: '',
      isActive: true,
    };
  }

  return {
    popupId: popup.id,
    title: popup.title ?? '',
    imageUrl: popup.imageUrl,
    linkUrl: popup.linkUrl ?? '',
    isActive: popup.isActive,
  };
}

export function AdminHomePopupPage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();

  const [popup, setPopup] = useState<AdminHomePopup | null>(null);
  const [form, setForm] = useState<PopupFormState>(toFormState(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadPopup = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminHomePopup();
      setPopup(result);
      setForm(toFormState(result));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '홈 팝업 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPopup();
  }, []);

  const uploadToCloudinary = async (file: File) => {
    const signed = await apiClient.signAdminUpload({
      usage: 'HOME_POPUP',
      fileName: file.name,
      contentType: file.type,
      size: file.size,
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

    return finalized.secureUrl;
  };

  const onUploadFile = async () => {
    if (!selectedFile) {
      setError('업로드할 파일을 먼저 선택해주세요.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const secureUrl = await uploadToCloudinary(selectedFile);
      setForm((current) => ({ ...current, imageUrl: secureUrl }));
      showToast('이미지 업로드를 완료했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const imageUrl = form.imageUrl.trim();

    if (imageUrl === '') {
      setError('팝업 이미지 URL을 입력해주세요.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const result = await apiClient.upsertAdminHomePopup({
        popupId: form.popupId,
        title: form.title.trim() || null,
        imageUrl,
        linkUrl: form.linkUrl.trim() || null,
        isActive: form.isActive,
      });

      setPopup(result);
      setForm(toFormState(result));
      showToast('홈 팝업을 저장했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '홈 팝업 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Home Popup</p>
          <h2 className="section-title admin-section-title">홈 팝업 관리</h2>
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>활성 상태</span>
            <strong>{form.isActive ? '노출' : '비노출'}</strong>
          </div>
          <div className="admin-stat-card">
            <span>최근 수정</span>
            <strong>{formatAdminDateTime(popup?.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <form className="surface-card admin-card-stack" onSubmit={onSubmit}>
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">Content</p>
            <h3 className="section-subtitle">팝업 노출 설정</h3>
          </div>
          <button className="button" type="submit" disabled={saving || loading}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>

        {loading ? <LoadingScreen mode="inline" title="팝업 설정 로딩 중" message="기존 팝업 설정을 불러오고 있습니다." /> : null}
        {error !== '' ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}

        {loading === false ? (
          <>
            <div className="admin-field-grid">
              <label className="field">
                <span>팝업 제목 (선택)</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="예: 4월 이벤트 안내"
                />
              </label>

              <label className="field">
                <span>링크 URL (선택)</span>
                <input
                  value={form.linkUrl}
                  onChange={(event) => setForm((current) => ({ ...current, linkUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </label>

              <label className="field field-checkbox">
                <span>노출 상태</span>
                <div className="checkbox-inline" style={{ marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  <span>메인 홈 진입 시 팝업 노출</span>
                </div>
              </label>
            </div>

            <div className="inline-actions">
              <label className="button button-secondary" style={{ cursor: 'pointer' }}>
                파일 선택
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button className="button button-ghost" type="button" onClick={() => void onUploadFile()} disabled={uploading}>
                {uploading ? '업로드 중...' : 'Cloudinary 업로드'}
              </button>
              <span className="admin-inline-note">{selectedFile ? selectedFile.name : '선택된 파일 없음'}</span>
            </div>

            <label className="field">
              <span>팝업 이미지 URL (업로드 후 자동 입력)</span>
              <input
                value={form.imageUrl}
                onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>

            <section className="surface-card admin-popup-preview-card">
              <p className="section-kicker">Preview</p>
              <h4 className="section-subtitle">팝업 미리보기</h4>
              {form.title.trim() !== '' ? <p className="section-copy section-copy-compact">{form.title.trim()}</p> : null}
              {form.imageUrl.trim() !== '' ? (
                <img className="admin-popup-preview-image" src={form.imageUrl.trim()} alt={form.title.trim() || '홈 팝업 이미지'} />
              ) : (
                <p className="section-copy section-copy-compact">이미지 URL을 입력하면 미리보기가 표시됩니다.</p>
              )}
            </section>
          </>
        ) : null}
      </form>
    </section>
  );
}
