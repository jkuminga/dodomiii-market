import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { AdminFloatingSubmitButton } from '../../components/admin/AdminFloatingSubmitButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminHomePopup, apiClient } from '../../lib/api';
import { AdminLayoutContext, formatAdminDateTime } from './adminUtils';
import { formatAdminFileSize, uploadAdminImageAsset } from './adminMediaUpload';

type PopupFormState = {
  popupId?: number;
  title: string;
  imageUrl: string;
  linkUrl: string;
  isActive: boolean;
};

const FLOATING_SUBMIT_SUCCESS_MS = 700;

function toPopupFormState(popup: AdminHomePopup | null): PopupFormState {
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

export function AdminHomePopupEditorPage() {
  const navigate = useNavigate();
  const params = useParams<{ popupId?: string }>();
  const { showToast } = useOutletContext<AdminLayoutContext>();
  const isEditMode = Boolean(params.popupId);
  const editPopupId = Number(params.popupId ?? 0);

  const [popup, setPopup] = useState<AdminHomePopup | null>(null);
  const [form, setForm] = useState<PopupFormState>(toPopupFormState(null));
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isEditMode) {
      setPopup(null);
      setForm(toPopupFormState(null));
      setLoading(false);
      setError('');
      return;
    }

    if (!Number.isFinite(editPopupId) || editPopupId <= 0) {
      setError('조회할 홈 팝업 ID가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getAdminHomePopupById(editPopupId);
        if (cancelled) {
          return;
        }

        setPopup(result);
        setForm(toPopupFormState(result));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '홈 팝업 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [editPopupId, isEditMode]);

  const updateField = <Key extends keyof PopupFormState>(key: Key, value: PopupFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));

    if (error !== '') {
      setError('');
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

  const onUploadFile = async () => {
    if (!selectedFile) {
      setError('업로드할 파일을 먼저 선택해주세요.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const secureUrl = await uploadAdminImageAsset(selectedFile, 'HOME_POPUP');
      setForm((current) => ({ ...current, imageUrl: secureUrl }));
      setSelectedFile(null);
      showToast('이미지 업로드를 완료했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

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
      setForm(toPopupFormState(result));
      showToast(isEditMode ? '홈 팝업을 수정했습니다.' : '홈 팝업을 생성했습니다.');
      setSaveSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));

      if (!isEditMode) {
        navigate(`/admin/home-popups/${result.id}`, { replace: true });
      }
    } catch (caught) {
      setSaveSuccess(false);
      setError(caught instanceof Error ? caught.message : '홈 팝업 저장에 실패했습니다.');
    } finally {
      setSaving(false);
      setSaveSuccess(false);
    }
  };

  const trimmedTitle = form.title.trim();
  const trimmedImageUrl = form.imageUrl.trim();
  const trimmedLinkUrl = form.linkUrl.trim();
  const imageRequiredError = error === '팝업 이미지 URL을 입력해주세요.';
  const uploadReady = selectedFile !== null;
  const selectedFileMeta =
    selectedFile !== null
      ? `${selectedFile.type || '형식 미확인'} · ${formatAdminFileSize(selectedFile.size)}`
      : '이미지 선택 후 업로드하면 URL이 자동으로 입력됩니다.';

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Home Popups</p>
          <h2 className="section-title admin-section-title">{isEditMode ? '홈 팝업 상세' : '홈 팝업 추가'}</h2>
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>노출 상태</span>
            <strong>{loading ? '확인 중' : form.isActive ? '노출 중' : '숨김'}</strong>
          </div>
          <div className="admin-stat-card">
            <span>이미지</span>
            <strong>{loading ? '확인 중' : trimmedImageUrl !== '' ? '연결 완료' : '입력 필요'}</strong>
          </div>
          <div className="admin-stat-card">
            <span>링크 이동</span>
            <strong>{loading ? '확인 중' : trimmedLinkUrl !== '' ? '설정됨' : '미사용'}</strong>
          </div>
          <div className="admin-stat-card">
            <span>최근 수정</span>
            <strong>{formatAdminDateTime(popup?.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <form className="admin-two-column admin-home-popup-layout admin-home-section-card" onSubmit={onSubmit} aria-busy={loading || saving || uploading}>
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
              <h3 className="section-subtitle">{isEditMode ? '팝업 정보 수정' : '신규 팝업 정보 입력'}</h3>
            </div>
            <div className="inline-actions">
              <button className="button" type="submit" disabled={saving || loading}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button className="button button-secondary" type="button" onClick={() => navigate('/admin/home-popups')} disabled={saving}>
                목록으로
              </button>
            </div>
          </div>

          {loading ? <LoadingScreen mode="inline" title="팝업 설정 로딩 중" message="팝업 정보를 불러오고 있습니다." /> : null}
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
                  <span>이미지</span>
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
                      <strong>팝업 노출 여부</strong>
                      <small>{form.isActive ? '현재 홈 화면에 팝업이 노출됩니다.' : '현재 홈 화면에 팝업이 노출되지 않습니다.'}</small>
                    </span>
                  </label>
                </div>
              </section>

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
                  ※ 업로드 없이 직접 이미지 주소 입력도 가능. 저장 전에 오른쪽 미리보기에서 이미지를 확인하세요.
                </p>
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
                  <strong>{trimmedLinkUrl !== '' ? '연결됨' : '없음'}</strong>
                </div>
              </div>
            </>
          )}
        </aside>
      </form>
    </section>
  );
}
