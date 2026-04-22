import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { AdminFloatingSubmitButton } from '../../components/admin/AdminFloatingSubmitButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminHomeHero, AdminHomePopup, AdminMediaUsage, apiClient } from '../../lib/api';
import { AdminLayoutContext, formatAdminDateTime } from './adminUtils';

type PopupFormState = {
  popupId?: number;
  title: string;
  imageUrl: string;
  linkUrl: string;
  isActive: boolean;
};

type HeroFormState = {
  imageUrl: string;
};

const FLOATING_SUBMIT_SUCCESS_MS = 700;

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

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toHeroFormState(hero: AdminHomeHero | null): HeroFormState {
  return {
    imageUrl: hero?.imageUrl ?? '',
  };
}

export function AdminHomePopupPage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();

  const [popup, setPopup] = useState<AdminHomePopup | null>(null);
  const [hero, setHero] = useState<AdminHomeHero | null>(null);
  const [form, setForm] = useState<PopupFormState>(toFormState(null));
  const [heroForm, setHeroForm] = useState<HeroFormState>(toHeroFormState(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [heroSaving, setHeroSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [heroSaveSuccess, setHeroSaveSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [error, setError] = useState('');
  const [heroError, setHeroError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedHeroFile, setSelectedHeroFile] = useState<File | null>(null);

  const loadPopup = async () => {
    setLoading(true);
    setError('');
    setHeroError('');

    try {
      const [popupResult, heroResult] = await Promise.all([apiClient.getAdminHomePopup(), apiClient.getAdminHomeHero()]);
      setPopup(popupResult);
      setForm(toFormState(popupResult));
      setHero(heroResult);
      setHeroForm(toHeroFormState(heroResult));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '홈 화면 설정 정보를 불러오지 못했습니다.';
      setError(message);
      setHeroError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPopup();
  }, []);

  const updateField = <Key extends keyof PopupFormState>(key: Key, value: PopupFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));

    if (error !== '') {
      setError('');
    }
  };

  const updateHeroField = <Key extends keyof HeroFormState>(key: Key, value: HeroFormState[Key]) => {
    setHeroForm((current) => ({ ...current, [key]: value }));

    if (heroError !== '') {
      setHeroError('');
    }
  };

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedFile(nextFile);

    if (error !== '') {
      setError('');
    }

    event.target.value = '';
  };

  const onSelectHeroFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedHeroFile(nextFile);

    if (heroError !== '') {
      setHeroError('');
    }

    event.target.value = '';
  };

  const uploadToCloudinary = async (file: File, usage: AdminMediaUsage) => {
    const signed = await apiClient.signAdminUpload({
      usage,
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
      const secureUrl = await uploadToCloudinary(selectedFile, 'HOME_POPUP');
      setForm((current) => ({ ...current, imageUrl: secureUrl }));
      setSelectedFile(null);
      showToast('이미지 업로드를 완료했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const onUploadHeroFile = async () => {
    if (!selectedHeroFile) {
      setHeroError('업로드할 히어로 이미지를 먼저 선택해주세요.');
      return;
    }

    setHeroUploading(true);
    setHeroError('');

    try {
      const secureUrl = await uploadToCloudinary(selectedHeroFile, 'HOME_HERO');
      setHeroForm((current) => ({ ...current, imageUrl: secureUrl }));
      setSelectedHeroFile(null);
      showToast('히어로 이미지 업로드를 완료했습니다.');
    } catch (caught) {
      setHeroError(caught instanceof Error ? caught.message : '히어로 이미지 업로드에 실패했습니다.');
    } finally {
      setHeroUploading(false);
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
    setSaveSuccess(false);
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
      setSaveSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));
    } catch (caught) {
      setSaveSuccess(false);
      setError(caught instanceof Error ? caught.message : '홈 팝업 저장에 실패했습니다.');
    } finally {
      setSaving(false);
      setSaveSuccess(false);
    }
  };

  const onSubmitHero = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const imageUrl = heroForm.imageUrl.trim();
    if (imageUrl === '') {
      setHeroError('히어로 이미지 URL을 입력해주세요.');
      return;
    }

    setHeroSaving(true);
    setHeroSaveSuccess(false);
    setHeroError('');

    try {
      const result = await apiClient.upsertAdminHomeHero({
        imageUrl,
      });

      setHero(result);
      setHeroForm(toHeroFormState(result));
      showToast('홈 히어로 이미지를 저장했습니다.');
      setHeroSaveSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));
    } catch (caught) {
      setHeroSaveSuccess(false);
      setHeroError(caught instanceof Error ? caught.message : '홈 히어로 이미지 저장에 실패했습니다.');
    } finally {
      setHeroSaving(false);
      setHeroSaveSuccess(false);
    }
  };

  const trimmedTitle = form.title.trim();
  const trimmedImageUrl = form.imageUrl.trim();
  const trimmedLinkUrl = form.linkUrl.trim();
  const imageRequiredError = error === '팝업 이미지 URL을 입력해주세요.';
  const uploadReady = selectedFile !== null;
  const hasExistingPopup = popup !== null;
  const hasHeroImage = hero !== null;
  const currentStatusLabel = loading ? '불러오는 중' : form.isActive ? '노출 중' : '비노출';
  const imageStatusLabel = loading ? '확인 중' : trimmedImageUrl !== '' ? '준비됨' : '미설정';
  const linkStatusLabel = loading ? '확인 중' : trimmedLinkUrl !== '' ? '연결됨' : '없음';
  const selectedFileMeta =
    selectedFile !== null
      ? `${selectedFile.type || '형식 미확인'} · ${formatFileSize(selectedFile.size)}`
      : '이미지 선택 후 업로드하면 URL이 자동으로 입력됩니다.';
  const trimmedHeroImageUrl = heroForm.imageUrl.trim();
  const heroImageStatusLabel = loading ? '확인 중' : trimmedHeroImageUrl !== '' ? '준비됨' : '미설정';
  const selectedHeroFileMeta =
    selectedHeroFile !== null
      ? `${selectedHeroFile.type || '형식 미확인'} · ${formatFileSize(selectedHeroFile.size)}`
      : '이미지 선택 후 업로드하면 URL이 자동으로 입력됩니다.';

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
            <strong>{currentStatusLabel}</strong>
          </div>
          <div className="admin-stat-card">
            <span>이미지 상태</span>
            <strong>{imageStatusLabel}</strong>
          </div>
          <div className="admin-stat-card">
            <span>최근 수정</span>
            <strong>{formatAdminDateTime(popup?.updatedAt)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>히어로 이미지</span>
            <strong>{heroImageStatusLabel}</strong>
          </div>
        </div>
      </section>

      <form className="admin-two-column admin-home-popup-layout" onSubmit={onSubmit} aria-busy={loading || saving || uploading}>
        <AdminFloatingSubmitButton
          busy={saving}
          busyLabel="저장 중..."
          disabled={saving || loading}
          label="팝업 저장"
          success={saveSuccess}
        />
        <section className="surface-card admin-card-stack admin-home-popup-editor">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Content</p>
              <h3 className="section-subtitle">팝업 노출 설정</h3>
              {/* <p className="section-copy section-copy-compact admin-home-popup-header-copy">
                홈 진입 팝업의 노출 상태, 연결 링크, 이미지 자산을 한 번에 관리합니다.
              </p> */}
            </div>
            <button className="button" type="submit" disabled={saving || loading}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>

          {loading ? <LoadingScreen mode="inline" title="팝업 설정 로딩 중" message="기존 팝업 설정을 불러오고 있습니다." /> : null}
          {error !== '' ? (
            <p className="feedback-copy is-error" id="admin-home-popup-feedback" role="alert">
              {error}
            </p>
          ) : null}

          {loading === false ? (
            <>
              <section className="admin-editor-overview-bar" aria-label="팝업 설정 요약">
                <div className="admin-overview-chip">
                  <span>노출 상태</span>
                  <strong>{form.isActive ? '표시됨' : '숨김'}</strong>
                </div>
                <div className="admin-overview-chip">
                  <span>이미지 자산</span>
                  <strong>{trimmedImageUrl !== '' ? '연결 완료' : '입력 필요'}</strong>
                </div>
                <div className="admin-overview-chip">
                  <span>링크 이동</span>
                  <strong>{trimmedLinkUrl !== '' ? '설정됨' : '미사용'}</strong>
                </div>
              </section>

              <section className="admin-form-section">
                <div className="admin-panel-head">
                  <div>
                    <strong>기본 정보</strong>
                  </div>
                </div>

                <div className="admin-field-grid">
                  <label className="field">
                    <span>팝업 제목 (선택)</span>
                    <input
                      value={form.title}
                      onChange={(event) => updateField('title', event.target.value)}
                      placeholder="예: 4월 이벤트 안내"
                    />
                  </label>

                  <label className="field">
                    <span>링크 URL (선택 : 이미지 클릭 시 이동할 페이지 주소)</span>
                    <input
                      value={form.linkUrl}
                      onChange={(event) => updateField('linkUrl', event.target.value)}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className="admin-check-grid admin-home-popup-check-grid">
                  <label className="admin-check-field admin-home-popup-toggle">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => updateField('isActive', event.target.checked)}
                    />
                    <span>
                      <strong>홈 화면에 팝업 활성화</strong>
                      <small>{form.isActive ? '현재 홈 화면에 팝업이 노출됩니다.' : '현재 홈 화면에 팝업이 노출되지 않습니다.'}</small>
                    </span>
                  </label>
                </div>
              </section>
              <br/>

              <section className="admin-form-section">
                <div className="admin-section-head">
                  <div>
                    <p className="section-kicker">Upload</p>
                    <h4 className="section-subtitle">팝업 이미지</h4>
                  </div>
                  <div className="admin-inline-note">※ Cloudinary 업로드 클릭 시 이미지 URL이 자동 입력됨.</div>
                </div>

                <div className="admin-home-popup-upload-grid">
                  <label className={`admin-home-popup-file-picker${uploadReady ? ' is-selected' : ''}`} htmlFor="admin-home-popup-file">
                    <span className="admin-home-popup-file-picker-kicker">Image Asset</span>
                    <strong>{selectedFile ? selectedFile.name : '팝업 이미지를 선택하세요'}</strong>
                    <p>JPG, PNG, WEBP 등 이미지 확장자 선택 가능</p>
                    <span className="admin-home-popup-file-picker-action">{selectedFile ? '다른 파일 선택' : '파일 고르기'}</span>
                  </label>

                  <section className="admin-subcard admin-home-popup-upload-card" aria-live="polite">
                    <div className="admin-home-popup-upload-meta">
                      <span>선택 파일</span>
                      <strong>{selectedFile ? selectedFile.name : '아직 파일이 선택되지 않았습니다.'}</strong>
                      <p>{selectedFileMeta}</p>
                    </div>

                    <div className="inline-actions admin-home-popup-upload-actions">
                      <button className="button" type="button" onClick={() => void onUploadFile()} disabled={!uploadReady || uploading}>
                        {uploading ? '업로드 중...' : 'Cloudinary 업로드'}
                      </button>
                      {selectedFile ? (
                        <button className="button button-ghost" type="button" onClick={() => setSelectedFile(null)} disabled={uploading}>
                          선택 해제
                        </button>
                      ) : null}
                    </div>
                  </section>
                </div>

                <input
                  id="admin-home-popup-file"
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  aria-describedby="admin-home-popup-upload-help"
                />

                <label className="field">
                  <span>팝업 이미지 URL</span>
                  <input
                    value={form.imageUrl}
                    onChange={(event) => updateField('imageUrl', event.target.value)}
                    placeholder="https://..."
                    aria-describedby="admin-home-popup-upload-help"
                    aria-invalid={imageRequiredError}
                  />
                </label>

                <p className="admin-inline-note admin-home-popup-upload-help" id="admin-home-popup-upload-help">
                  ※ 업로드 없이 직접 입력도 가능. 저장 전에 아래 미리보기에서 이미지를 확인하세요.
                </p>
              </section>

              <section className="admin-home-popup-action-bar" aria-label="저장 안내">
                <div className="admin-home-popup-action-copy" role="status" aria-live="polite">
                  <strong>{hasExistingPopup ? '기존 팝업을 수정 중입니다.' : '새 홈 팝업을 만들 준비가 되었습니다.'}</strong>
                  <p>
                    {trimmedImageUrl !== ''
                      ? '저장하면 현재 설정이 스토어 홈 팝업에 반영됩니다.'
                      : '이미지 URL을 입력하거나 업로드한 뒤 저장하면 스토어 팝업에 반영됩니다.'}
                  </p>
                </div>
                <button className="button" type="submit" disabled={saving}>
                  {saving ? '저장 중...' : '변경사항 저장'}
                </button>
              </section>
            </>
          ) : null}
        </section>

        <aside className="surface-card admin-card-stack admin-home-popup-preview-panel">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Preview</p>
              <h3 className="section-subtitle">스토어 팝업 미리보기</h3>
            </div>
            <span className={`admin-home-popup-preview-badge${loading || form.isActive ? '' : ' is-muted'}`}>
              {loading ? '설정 확인 중' : form.isActive ? '노출 예정' : '비노출 예정'}
            </span>
          </div>

          <p className="section-copy section-copy-compact">
            실제 스토어 팝업 구성에 맞춰 확인할 수 있습니다. 이미지가 없으면 빈 상태가 표시됩니다.
          </p>

          {loading ? (
            <LoadingScreen mode="inline" title="미리보기 준비 중" message="저장된 팝업 설정을 확인하고 있습니다." />
          ) : (
            <>
              <div className="admin-home-popup-preview-stage" aria-live="polite">
                <div className="home-popup-card admin-home-popup-preview-frame">
                  <div className="home-popup-body admin-home-popup-preview-body">
                    {trimmedImageUrl !== '' ? (
                      <>
                        <img className="admin-popup-preview-image" src={trimmedImageUrl} alt={trimmedTitle || '홈 팝업 이미지'} />
                        {trimmedLinkUrl !== '' ? <span className="admin-home-popup-preview-link-badge">클릭 시 새 창 이동</span> : null}
                      </>
                    ) : (
                      <div className="admin-home-popup-preview-empty">
                        <strong>이미지 미리보기 준비 중</strong>
                        <p>이미지 URL을 입력하거나 파일 업로드를 완료하면 이 영역에 실제 팝업 이미지가 나타납니다.</p>
                      </div>
                    )}
                  </div>

                  <div className="home-popup-actions" aria-hidden="true">
                    <span className="button button-ghost home-popup-dismiss">하루 동안 보지 않기</span>
                    <span className="button home-popup-dismiss">닫기</span>
                  </div>
                </div>
              </div>

              <div className="admin-home-popup-preview-summary">
                <div className="admin-summary-item">
                  <span>제목</span>
                  <strong>{trimmedTitle !== '' ? trimmedTitle : '제목 없음'}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>링크</span>
                  <strong>{linkStatusLabel}</strong>
                </div>
                <div className="admin-summary-item admin-home-popup-summary-span-2">
                  <span>운영 메모</span>
                  <strong>{trimmedTitle !== '' ? '제목은 alt 텍스트와 운영 식별에 함께 사용됩니다.' : '제목을 입력하면 운영 식별과 접근성 텍스트를 더 명확하게 관리할 수 있습니다.'}</strong>
                </div>
              </div>
            </>
          )}
        </aside>
      </form>

      <form className="admin-two-column admin-home-popup-layout" onSubmit={onSubmitHero} aria-busy={loading || heroSaving || heroUploading}>
        <AdminFloatingSubmitButton
          busy={heroSaving}
          busyLabel="저장 중..."
          disabled={heroSaving || loading}
          label="히어로 저장"
          success={heroSaveSuccess}
        />
        <section className="surface-card admin-card-stack admin-home-popup-editor">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Hero</p>
              <h3 className="section-subtitle">홈 히어로 이미지</h3>
            </div>
            <button className="button" type="submit" disabled={heroSaving || loading}>
              {heroSaving ? '저장 중...' : '저장'}
            </button>
          </div>

          {heroError !== '' ? (
            <p className="feedback-copy is-error" role="alert">
              {heroError}
            </p>
          ) : null}

          {loading === false ? (
            <>
              <section className="admin-editor-overview-bar" aria-label="히어로 설정 요약">
                <div className="admin-overview-chip">
                  <span>현재 상태</span>
                  <strong>{trimmedHeroImageUrl !== '' ? '연결 완료' : '입력 필요'}</strong>
                </div>
                <div className="admin-overview-chip">
                  <span>업로드 준비</span>
                  <strong>{selectedHeroFile ? '파일 선택됨' : '파일 미선택'}</strong>
                </div>
                <div className="admin-overview-chip">
                  <span>최근 수정</span>
                  <strong>{formatAdminDateTime(hero?.updatedAt)}</strong>
                </div>
              </section>

              <section className="admin-form-section">
                <div className="admin-section-head">
                  <div>
                    <p className="section-kicker">Upload</p>
                    <h4 className="section-subtitle">히어로 배경 이미지</h4>
                  </div>
                  <div className="admin-inline-note">※ Cloudinary 업로드 클릭 시 이미지 URL이 자동 입력됨.</div>
                </div>

                <div className="admin-home-popup-upload-grid">
                  <label className={`admin-home-popup-file-picker${selectedHeroFile ? ' is-selected' : ''}`} htmlFor="admin-home-hero-file">
                    <span className="admin-home-popup-file-picker-kicker">Hero Image</span>
                    <strong>{selectedHeroFile ? selectedHeroFile.name : '히어로 이미지를 선택하세요'}</strong>
                    <p>스토어 홈 상단 배경으로 사용됩니다.</p>
                    <span className="admin-home-popup-file-picker-action">{selectedHeroFile ? '다른 파일 선택' : '파일 고르기'}</span>
                  </label>

                  <section className="admin-subcard admin-home-popup-upload-card" aria-live="polite">
                    <div className="admin-home-popup-upload-meta">
                      <span>선택 파일</span>
                      <strong>{selectedHeroFile ? selectedHeroFile.name : '아직 파일이 선택되지 않았습니다.'}</strong>
                      <p>{selectedHeroFileMeta}</p>
                    </div>

                    <div className="inline-actions admin-home-popup-upload-actions">
                      <button className="button" type="button" onClick={() => void onUploadHeroFile()} disabled={!selectedHeroFile || heroUploading}>
                        {heroUploading ? '업로드 중...' : 'Cloudinary 업로드'}
                      </button>
                      {selectedHeroFile ? (
                        <button className="button button-ghost" type="button" onClick={() => setSelectedHeroFile(null)} disabled={heroUploading}>
                          선택 해제
                        </button>
                      ) : null}
                    </div>
                  </section>
                </div>

                <input
                  id="admin-home-hero-file"
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={onSelectHeroFile}
                />

                <label className="field">
                  <span>히어로 이미지 URL</span>
                  <input
                    value={heroForm.imageUrl}
                    onChange={(event) => updateHeroField('imageUrl', event.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </section>

              <section className="admin-home-popup-action-bar" aria-label="히어로 저장 안내">
                <div className="admin-home-popup-action-copy" role="status" aria-live="polite">
                  <strong>{hasHeroImage ? '기존 히어로 이미지를 수정 중입니다.' : '새 홈 히어로 이미지를 설정할 수 있습니다.'}</strong>
                  <p>
                    {trimmedHeroImageUrl !== ''
                      ? '저장하면 스토어 홈 상단 히어로 영역에 즉시 반영됩니다.'
                      : '이미지 URL을 입력하거나 업로드한 뒤 저장하면 스토어 홈 상단에 반영됩니다.'}
                  </p>
                </div>
                <button className="button" type="submit" disabled={heroSaving}>
                  {heroSaving ? '저장 중...' : '변경사항 저장'}
                </button>
              </section>
            </>
          ) : null}
        </section>

        <aside className="surface-card admin-card-stack admin-home-popup-preview-panel">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Preview</p>
              <h3 className="section-subtitle">히어로 미리보기</h3>
            </div>
            <span className={`admin-home-popup-preview-badge${loading || trimmedHeroImageUrl !== '' ? '' : ' is-muted'}`}>
              {loading ? '설정 확인 중' : trimmedHeroImageUrl !== '' ? '노출 예정' : '미설정'}
            </span>
          </div>

          <p className="section-copy section-copy-compact">홈 첫 화면의 상단 배경 이미지로 사용됩니다.</p>

          <div className="admin-home-hero-preview-stage">
            {trimmedHeroImageUrl !== '' ? (
              <img className="admin-home-hero-preview-image" src={trimmedHeroImageUrl} alt="홈 히어로 미리보기" />
            ) : (
              <div className="admin-home-popup-preview-empty">
                <strong>히어로 이미지 미리보기 준비 중</strong>
                <p>이미지 URL을 입력하거나 업로드를 완료하면 이 영역에 실제 히어로 이미지가 표시됩니다.</p>
              </div>
            )}
          </div>
        </aside>
      </form>
    </section>
  );
}
