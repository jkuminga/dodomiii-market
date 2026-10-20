import { type CSSProperties, ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { AdminFloatingSubmitButton } from '../../components/admin/AdminFloatingSubmitButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import {
  AdminHomeHero,
  AdminStorefrontSettings,
  StoreWebFontFamily,
  StoreWebFontWeightPreset,
  UserWebFontSize,
  apiClient,
} from '../../lib/api';
import {
  DEFAULT_STORE_WEB_FONT_FAMILY,
  DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET,
  STORE_WEB_FONT_OPTIONS,
  STORE_WEB_FONT_WEIGHT_OPTIONS,
} from '../../lib/storeFonts';
import { AdminLayoutContext, formatAdminDateTime } from './adminUtils';
import { formatAdminFileSize, uploadAdminImageAsset } from './adminMediaUpload';

type HeroFormState = {
  imageUrl: string;
};

type StorefrontSettingsFormState = {
  userWebFontSize: UserWebFontSize;
  userWebFontFamily: StoreWebFontFamily;
  userWebFontWeightPreset: StoreWebFontWeightPreset;
};

const USER_WEB_FONT_SIZE_OPTIONS: Array<{
  value: UserWebFontSize;
  label: string;
}> = [
  { value: 'VERY_SMALL', label: '매우 작음' },
  { value: 'SMALL', label: '작음' },
  { value: 'NORMAL', label: '보통' },
  { value: 'LARGE', label: '큼' },
  { value: 'VERY_LARGE', label: '매우 큼' },
];

const FLOATING_SUBMIT_SUCCESS_MS = 700;

function toHeroFormState(hero: AdminHomeHero | null): HeroFormState {
  return {
    imageUrl: hero?.imageUrl ?? '',
  };
}

function toStorefrontSettingsFormState(settings: AdminStorefrontSettings | null): StorefrontSettingsFormState {
  return {
    userWebFontSize: settings?.userWebFontSize ?? 'NORMAL',
    userWebFontFamily: settings?.userWebFontFamily ?? DEFAULT_STORE_WEB_FONT_FAMILY,
    userWebFontWeightPreset: settings?.userWebFontWeightPreset ?? DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET,
  };
}

export function AdminHomePage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();

  const [hero, setHero] = useState<AdminHomeHero | null>(null);
  const [storefrontSettings, setStorefrontSettings] = useState<AdminStorefrontSettings | null>(null);
  const [heroForm, setHeroForm] = useState<HeroFormState>(toHeroFormState(null));
  const [storefrontSettingsForm, setStorefrontSettingsForm] = useState<StorefrontSettingsFormState>(toStorefrontSettingsFormState(null));
  const [loading, setLoading] = useState(true);
  const [heroSaving, setHeroSaving] = useState(false);
  const [storefrontSettingsSaving, setStorefrontSettingsSaving] = useState(false);
  const [heroSaveSuccess, setHeroSaveSuccess] = useState(false);
  const [storefrontSettingsSaveSuccess, setStorefrontSettingsSaveSuccess] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroError, setHeroError] = useState('');
  const [storefrontSettingsError, setStorefrontSettingsError] = useState('');
  const [selectedHeroFile, setSelectedHeroFile] = useState<File | null>(null);

  const loadHomeSettings = async () => {
    setLoading(true);
    setHeroError('');
    setStorefrontSettingsError('');

    try {
      const [heroResult, storefrontSettingsResult] = await Promise.all([
        apiClient.getAdminHomeHero(),
        apiClient.getAdminStorefrontSettings(),
      ]);

      setHero(heroResult);
      setHeroForm(toHeroFormState(heroResult));
      setStorefrontSettings(storefrontSettingsResult);
      setStorefrontSettingsForm(toStorefrontSettingsFormState(storefrontSettingsResult));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '홈 화면 설정 정보를 불러오지 못했습니다.';
      setHeroError(message);
      setStorefrontSettingsError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHomeSettings();
  }, []);

  const updateHeroField = <Key extends keyof HeroFormState>(key: Key, value: HeroFormState[Key]) => {
    setHeroForm((current) => ({ ...current, [key]: value }));

    if (heroError !== '') {
      setHeroError('');
    }
  };

  const updateStorefrontSettingsField = <Key extends keyof StorefrontSettingsFormState>(
    key: Key,
    value: StorefrontSettingsFormState[Key],
  ) => {
    setStorefrontSettingsForm((current) => ({ ...current, [key]: value }));

    if (storefrontSettingsError !== '') {
      setStorefrontSettingsError('');
    }
  };

  const updateStorefrontFontFamily = (value: StoreWebFontFamily) => {
    const nextFont = STORE_WEB_FONT_OPTIONS.find((option) => option.value === value);

    setStorefrontSettingsForm((current) => ({
      ...current,
      userWebFontFamily: value,
      userWebFontWeightPreset: nextFont?.supportsWeightPreset ? current.userWebFontWeightPreset : DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET,
    }));

    if (storefrontSettingsError !== '') {
      setStorefrontSettingsError('');
    }
  };

  const onSelectHeroFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedHeroFile(nextFile);

    if (heroError !== '') {
      setHeroError('');
    }

    event.target.value = '';
  };

  const onUploadHeroFile = async () => {
    if (!selectedHeroFile) {
      setHeroError('업로드할 히어로 이미지를 먼저 선택해주세요.');
      return;
    }

    setHeroUploading(true);
    setHeroError('');

    try {
      const secureUrl = await uploadAdminImageAsset(selectedHeroFile, 'HOME_HERO');
      setHeroForm((current) => ({ ...current, imageUrl: secureUrl }));
      setSelectedHeroFile(null);
      showToast('히어로 이미지 업로드를 완료했습니다.');
    } catch (caught) {
      setHeroError(caught instanceof Error ? caught.message : '히어로 이미지 업로드에 실패했습니다.');
    } finally {
      setHeroUploading(false);
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

  const selectedFontOption =
    STORE_WEB_FONT_OPTIONS.find((option) => option.value === storefrontSettingsForm.userWebFontFamily) ??
    STORE_WEB_FONT_OPTIONS[0];
  const selectedFontWeightOption =
    STORE_WEB_FONT_WEIGHT_OPTIONS.find((option) => option.value === storefrontSettingsForm.userWebFontWeightPreset) ??
    STORE_WEB_FONT_WEIGHT_OPTIONS[1];

  const onSubmitStorefrontSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setStorefrontSettingsSaving(true);
    setStorefrontSettingsSaveSuccess(false);
    setStorefrontSettingsError('');

    try {
      const result = await apiClient.updateAdminStorefrontSettings({
        userWebFontSize: storefrontSettingsForm.userWebFontSize,
        userWebFontFamily: storefrontSettingsForm.userWebFontFamily,
        userWebFontWeightPreset: selectedFontOption.supportsWeightPreset
          ? storefrontSettingsForm.userWebFontWeightPreset
          : DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET,
      });

      setStorefrontSettings(result);
      setStorefrontSettingsForm(toStorefrontSettingsFormState(result));
      showToast('사용자 웹 표시 설정을 저장했습니다.');
      setStorefrontSettingsSaveSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));
    } catch (caught) {
      setStorefrontSettingsSaveSuccess(false);
      setStorefrontSettingsError(caught instanceof Error ? caught.message : '사용자 웹 표시 설정 저장에 실패했습니다.');
    } finally {
      setStorefrontSettingsSaving(false);
      setStorefrontSettingsSaveSuccess(false);
    }
  };

  const selectedFontSizeOption =
    USER_WEB_FONT_SIZE_OPTIONS.find((option) => option.value === storefrontSettingsForm.userWebFontSize) ??
    USER_WEB_FONT_SIZE_OPTIONS[2];
  const selectedFontSizeIndex = Math.max(
    USER_WEB_FONT_SIZE_OPTIONS.findIndex((option) => option.value === storefrontSettingsForm.userWebFontSize),
    0,
  );
  const trimmedHeroImageUrl = heroForm.imageUrl.trim();
  const heroImageStatusLabel = loading ? '확인 중' : trimmedHeroImageUrl !== '' ? '준비됨' : '미설정';
  const selectedHeroFileMeta =
    selectedHeroFile !== null
      ? `${selectedHeroFile.type || '형식 미확인'} · ${formatAdminFileSize(selectedHeroFile.size)}`
      : '이미지 선택 후 업로드하면 URL이 자동으로 입력됩니다.';

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Home & Theme</p>
          <h2 className="section-title admin-section-title">홈 화면 관리</h2>
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>히어로 이미지</span>
            <strong>{heroImageStatusLabel}</strong>
          </div>
          <div className="admin-stat-card">
            <span>최근 수정</span>
            <strong>{formatAdminDateTime(hero?.updatedAt ?? storefrontSettings?.updatedAt)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>사용자 웹 글자</span>
            <strong>{loading ? '확인 중' : selectedFontSizeOption.label}</strong>
          </div>
          <div className="admin-stat-card">
            <span>사용자 웹 폰트</span>
            <strong>{loading ? '확인 중' : selectedFontOption.label}</strong>
          </div>
          <div className="admin-stat-card">
            <span>사용자 웹 굵기</span>
            <strong>{loading ? '확인 중' : selectedFontOption.supportsWeightPreset ? selectedFontWeightOption.label : '기본'}</strong>
          </div>
        </div>
      </section>

      <form className="surface-card admin-card-stack admin-home-section-card admin-storefront-settings-form" onSubmit={onSubmitStorefrontSettings} aria-busy={loading || storefrontSettingsSaving}>
        <AdminFloatingSubmitButton
          busy={storefrontSettingsSaving}
          busyLabel="저장 중..."
          disabled={storefrontSettingsSaving || loading}
          label="표시 설정 저장"
          success={storefrontSettingsSaveSuccess}
        />
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">User Web</p>
            <h3 className="section-subtitle">사용자 웹 표시 설정</h3>
            <p className="section-copy section-copy-compact">
              사용자 웹 전체의 폰트, 굵기, 글자 크기를 설정합니다. 기본 값은 하남다움체와 보통입니다.
            </p>
          </div>
          <button className="button" type="submit" disabled={storefrontSettingsSaving || loading}>
            {storefrontSettingsSaving ? '저장 중...' : '저장'}
          </button>
        </div>

        {storefrontSettingsError !== '' ? (
          <p className="feedback-copy is-error" role="alert">
            {storefrontSettingsError}
          </p>
        ) : null}

        {loading ? (
          <LoadingScreen mode="inline" title="글자 크기 설정 로딩 중" message="사용자 웹 표시 설정을 불러오고 있습니다." />
        ) : (
          <>
            <div className="admin-storefront-setting-group">
              <div className="admin-field-heading">
                <strong>폰트 타입</strong>
                <span>{selectedFontOption.label}</span>
              </div>
              <div className="admin-font-family-grid" aria-label="사용자 웹 폰트 타입 선택">
                {STORE_WEB_FONT_OPTIONS.map((option) => (
                  <label
                    className={`admin-font-family-option${storefrontSettingsForm.userWebFontFamily === option.value ? ' is-selected' : ''}`}
                    key={option.value}
                  >
                    <input
                      type="radio"
                      name="userWebFontFamily"
                      value={option.value}
                      checked={storefrontSettingsForm.userWebFontFamily === option.value}
                      onChange={() => updateStorefrontFontFamily(option.value)}
                    />
                    <span className="admin-font-family-option-copy">
                      <strong style={{ fontFamily: `'${option.cssFamily}', sans-serif` }}>가나다 ABC 123</strong>
                      <span>{option.label}{option.supportsWeightPreset ? ' · 굵기 지원' : ''}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-storefront-setting-group">
              <div className="admin-field-heading">
                <strong>글자 굵기</strong>
                <span>{selectedFontOption.supportsWeightPreset ? selectedFontWeightOption.label : '선택한 폰트는 단일 굵기입니다'}</span>
              </div>
              <div
                className={`admin-font-weight-grid${selectedFontOption.supportsWeightPreset ? '' : ' is-disabled'}`}
                aria-label="사용자 웹 글자 굵기 선택"
              >
                {STORE_WEB_FONT_WEIGHT_OPTIONS.map((option) => (
                  <label
                    className={`admin-font-weight-option${storefrontSettingsForm.userWebFontWeightPreset === option.value ? ' is-selected' : ''}`}
                    key={option.value}
                    aria-disabled={!selectedFontOption.supportsWeightPreset}
                  >
                    <input
                      type="radio"
                      name="userWebFontWeightPreset"
                      value={option.value}
                      checked={storefrontSettingsForm.userWebFontWeightPreset === option.value}
                      disabled={!selectedFontOption.supportsWeightPreset}
                      onChange={() => updateStorefrontSettingsField('userWebFontWeightPreset', option.value)}
                    />
                    <span className="admin-font-weight-option-copy">
                      <strong style={{ fontFamily: `'${selectedFontOption.cssFamily}', sans-serif`, fontWeight: option.previewWeight }}>
                        가나다 ABC 123
                      </strong>
                      <span>{option.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-storefront-setting-group">
              <div className="admin-field-heading">
                <strong>글자 크기</strong>
                <span>{selectedFontSizeOption.label}</span>
              </div>
              <div
                className="admin-font-size-slider"
                style={{ '--selected-font-size-index': selectedFontSizeIndex } as CSSProperties}
                aria-label="사용자 웹 글자 크기 선택"
              >
                <div className="admin-font-size-slider-track" aria-hidden="true">
                  <span className="admin-font-size-slider-dot" />
                </div>
                <div className="admin-font-size-slider-options">
                  {USER_WEB_FONT_SIZE_OPTIONS.map((option) => (
                    <label
                      className={`admin-font-size-slider-option${storefrontSettingsForm.userWebFontSize === option.value ? ' is-selected' : ''}`}
                      key={option.value}
                    >
                      <input
                        type="radio"
                        name="userWebFontSize"
                        value={option.value}
                        checked={storefrontSettingsForm.userWebFontSize === option.value}
                        onChange={() => updateStorefrontSettingsField('userWebFontSize', option.value)}
                      />
                      <span className="admin-font-size-slider-hit" aria-hidden="true" />
                      <strong>{option.label}</strong>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </form>

      <form className="admin-two-column admin-home-popup-layout admin-home-section-card" onSubmit={onSubmitHero} aria-busy={loading || heroSaving || heroUploading}>
        <AdminFloatingSubmitButton
          busy={heroSaving}
          busyLabel="저장 중..."
          disabled={heroSaving || loading}
          label="홈 이미지 저장"
          success={heroSaveSuccess}
        />
        <section className="surface-card admin-card-stack admin-home-popup-editor">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Main Image</p>
              <h3 className="section-subtitle">홈 메인 이미지</h3>
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
                    <h4 className="section-subtitle">홈 메인 배경 이미지</h4>
                  </div>
                  <div className="admin-inline-note">※ Cloudinary 업로드 클릭 시 이미지 URL이 자동 입력됨.</div>
                </div>

                <div className="admin-home-popup-upload-grid">
                  <label className={`admin-home-popup-file-picker${selectedHeroFile ? ' is-selected' : ''}`} htmlFor="admin-home-hero-file">
                    <span className="admin-home-popup-file-picker-kicker">Image</span>
                    <strong>{selectedHeroFile ? selectedHeroFile.name : '이미지를 선택하세요'}</strong>
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
                  <span>홈 메인 이미지 URL</span>
                  <input
                    value={heroForm.imageUrl}
                    onChange={(event) => updateHeroField('imageUrl', event.target.value)}
                    placeholder="https://..."
                  />
                </label>
              </section>
            </>
          ) : null}
        </section>

        <aside className="surface-card admin-card-stack admin-home-popup-preview-panel">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Preview</p>
              <h3 className="section-subtitle">미리보기</h3>
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
                <strong>홈 메인 이미지 미리보기 준비 중</strong>
                <p>이미지 URL을 입력하거나 업로드를 완료하면 이 영역에 실제 히어로 이미지가 표시됩니다.</p>
              </div>
            )}
          </div>
        </aside>
      </form>
    </section>
  );
}
