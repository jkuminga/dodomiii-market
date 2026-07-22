import { ChangeEvent, FormEvent, useEffect, useState, type KeyboardEvent } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { AdminFloatingSubmitButton } from '../../components/admin/AdminFloatingSubmitButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminHomeItem, AdminProductListItem, HomeItemSection, apiClient } from '../../lib/api';
import { AdminLayoutContext, formatAdminDateTime } from './adminUtils';
import { formatAdminFileSize, uploadAdminImageAsset } from './adminMediaUpload';

type HomeItemFormState = {
  itemId?: number;
  section: HomeItemSection;
  title: string;
  imageUrl: string;
  productId: number | '';
  sortOrder: number;
  isActive: boolean;
};

type ProductOptionSnapshot = Pick<AdminProductListItem, 'id' | 'name' | 'slug' | 'thumbnailImageUrl' | 'isVisible'>;

const HOME_ITEM_SECTION_LABELS: Record<HomeItemSection, string> = {
  NEW_ARRIVAL: 'NEW',
  BEST: 'BEST',
};
const FLOATING_SUBMIT_SUCCESS_MS = 700;

function toHomeItemFormState(item: AdminHomeItem | null): HomeItemFormState {
  if (item === null) {
    return {
      section: 'NEW_ARRIVAL',
      title: '',
      imageUrl: '',
      productId: '',
      sortOrder: 0,
      isActive: true,
    };
  }

  return {
    itemId: item.id,
    section: item.section,
    title: item.title ?? '',
    imageUrl: item.imageUrl ?? '',
    productId: item.productId,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
  };
}

function getProductSnapshot(item: AdminHomeItem): ProductOptionSnapshot {
  return {
    id: item.productId,
    name: item.productName,
    slug: item.productSlug,
    thumbnailImageUrl: item.productThumbnailImageUrl,
    isVisible: item.productIsVisible,
  };
}

export function AdminHomeItemEditorPage() {
  const navigate = useNavigate();
  const params = useParams<{ itemId?: string }>();
  const { showToast } = useOutletContext<AdminLayoutContext>();
  const isEditMode = Boolean(params.itemId);
  const editItemId = Number(params.itemId ?? 0);

  const [item, setItem] = useState<AdminHomeItem | null>(null);
  const [form, setForm] = useState<HomeItemFormState>(toHomeItemFormState(null));
  const [selectedProductSnapshot, setSelectedProductSnapshot] = useState<ProductOptionSnapshot | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<AdminProductListItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const updateField = <Key extends keyof HomeItemFormState>(key: Key, value: HomeItemFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));

    if (error !== '') {
      setError('');
    }
  };

  const loadProductOptions = async (query = productSearch) => {
    setProductsLoading(true);

    try {
      const result = await apiClient.getAdminProducts({
        q: query.trim() || undefined,
        isVisible: true,
        deletedStatus: 'active',
        sort: 'updated_desc',
        page: 1,
        size: 12,
      });
      setProductOptions(result.data.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '상품 목록을 불러오지 못했습니다.');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    void loadProductOptions('');
  }, []);

  useEffect(() => {
    if (!isEditMode) {
      setItem(null);
      setForm(toHomeItemFormState(null));
      setSelectedProductSnapshot(null);
      setLoading(false);
      setError('');
      return;
    }

    if (!Number.isFinite(editItemId) || editItemId <= 0) {
      setError('조회할 홈 아이템 ID가 올바르지 않습니다.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getAdminHomeItemById(editItemId);
        if (cancelled) {
          return;
        }

        setItem(result);
        setForm(toHomeItemFormState(result));
        setSelectedProductSnapshot(getProductSnapshot(result));
        setProductSearch(result.productName);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '홈 아이템 정보를 불러오지 못했습니다.');
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
  }, [editItemId, isEditMode]);

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
      const secureUrl = await uploadAdminImageAsset(selectedFile, 'HOME_ITEM');
      setForm((current) => ({ ...current, imageUrl: secureUrl }));
      setSelectedFile(null);
      showToast('이미지 업로드를 완료했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const onSearchProducts = () => {
    void loadProductOptions(productSearch);
  };

  const onProductSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void loadProductOptions(productSearch);
  };

  const onSelectProduct = (product: AdminProductListItem) => {
    updateField('productId', product.id);
    setSelectedProductSnapshot(product);
    setProductSearch(product.name);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    const imageUrl = form.imageUrl.trim();
    const productId = typeof form.productId === 'number' ? form.productId : Number(form.productId);

    if (!Number.isInteger(productId) || productId <= 0) {
      setError('연결할 상품을 선택해주세요.');
      return;
    }

    if (form.section === 'NEW_ARRIVAL' && imageUrl === '') {
      setError('New Arrival 이미지 URL을 입력해주세요.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      const result = await apiClient.upsertAdminHomeItem({
        itemId: form.itemId,
        section: form.section,
        title: form.title.trim() || null,
        imageUrl: imageUrl || null,
        productId,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      });

      setItem(result);
      setForm(toHomeItemFormState(result));
      setSelectedProductSnapshot(getProductSnapshot(result));
      showToast(isEditMode ? '홈 아이템을 수정했습니다.' : '홈 아이템을 생성했습니다.');
      setSaveSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));

      if (!isEditMode) {
        navigate(`/admin/home-items/${result.id}`, { replace: true });
      }
    } catch (caught) {
      setSaveSuccess(false);
      setError(caught instanceof Error ? caught.message : '홈 아이템 저장에 실패했습니다.');
    } finally {
      setSaving(false);
      setSaveSuccess(false);
    }
  };

  const trimmedTitle = form.title.trim();
  const trimmedImageUrl = form.imageUrl.trim();
  const sectionLabel = HOME_ITEM_SECTION_LABELS[form.section];
  const uploadReady = selectedFile !== null;
  const selectedFileMeta =
    selectedFile !== null
      ? `${selectedFile.type || '형식 미확인'} / ${formatAdminFileSize(selectedFile.size)}`
      : '이미지 선택 후 업로드하면 URL이 자동으로 입력됩니다.';
  const selectedProduct =
    productOptions.find((product) => product.id === form.productId) ??
    selectedProductSnapshot;
  const previewImageUrl = trimmedImageUrl || selectedProduct?.thumbnailImageUrl || '';

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Home Items</p>
          <h2 className="section-title admin-section-title">{isEditMode ? '홈 아이템 상세' : '홈 아이템 추가'}</h2>
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
            <span>연결 상품</span>
            <strong>{loading ? '확인 중' : selectedProduct ? selectedProduct.name : '선택 필요'}</strong>
          </div>
          <div className="admin-stat-card">
            <span>최근 수정</span>
            <strong>{formatAdminDateTime(item?.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <form className="admin-two-column admin-home-popup-layout admin-home-section-card" onSubmit={onSubmit} aria-busy={loading || saving || uploading}>
        <AdminFloatingSubmitButton
          busy={saving}
          busyLabel="저장 중..."
          disabled={saving || loading}
          label="항목 저장"
          success={saveSuccess}
        />

        <section className="surface-card admin-card-stack admin-home-popup-editor">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Content</p>
              <h3 className="section-subtitle">{isEditMode ? '항목 정보 수정' : '신규 항목 정보 입력'}</h3>
            </div>
            <div className="inline-actions">
              <button className="button" type="submit" disabled={saving || loading}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button className="button button-secondary" type="button" onClick={() => navigate('/admin/home-items')} disabled={saving}>
                목록으로
              </button>
            </div>
          </div>

          {loading ? <LoadingScreen mode="inline" title="홈 아이템 로딩 중" message="항목 정보를 불러오고 있습니다." /> : null}
          {error !== '' ? (
            <p className="feedback-copy is-error" role="alert">
              {error}
            </p>
          ) : null}

          {loading === false ? (
            <>
              <section className="admin-editor-overview-bar" aria-label="홈 아이템 설정 요약">
                <div className="admin-overview-chip">
                  <span>섹션</span>
                  <strong>{sectionLabel}</strong>
                </div>
                <div className="admin-overview-chip">
                  <span>노출 상태</span>
                  <strong>{form.isActive ? '표시됨' : '숨김'}</strong>
                </div>
                <div className="admin-overview-chip">
                  <span>노출 순서</span>
                  <strong>{form.sortOrder}</strong>
                </div>
                <div className="admin-overview-chip">
                  <span>연결 상품</span>
                  <strong>{selectedProduct ? selectedProduct.name : '미선택'}</strong>
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
                    <span>홈 섹션</span>
                    <select
                      value={form.section}
                      onChange={(event) => updateField('section', event.target.value as HomeItemSection)}
                    >
                      <option value="NEW_ARRIVAL">NEW</option>
                      <option value="BEST">BEST</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>표시 제목 (선택)</span>
                    <input
                      value={form.title}
                      onChange={(event) => updateField('title', event.target.value)}
                      placeholder="예: 따끈따끈 신상품"
                    />
                  </label>

                  <label className="field">
                    <span>노출 순서</span>
                    <input
                      type="number"
                      value={form.sortOrder}
                      onChange={(event) => updateField('sortOrder', Number(event.target.value))}
                      placeholder="0"
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
                      <strong>홈 아이템 노출 여부</strong>
                      <small>{form.isActive ? `${sectionLabel} 섹션에 노출됩니다.` : '프로토타입 홈에 노출되지 않습니다.'}</small>
                    </span>
                  </label>
                </div>
              </section>

              <section className="admin-form-section">
                <div className="admin-section-head">
                  <div>
                    <p className="section-kicker">Product</p>
                    <h4 className="section-subtitle">연결 상품</h4>
                  </div>
                  <div className="admin-inline-note">이미지를 클릭하면 선택한 상품 상세로 이동합니다.</div>
                </div>

                <div className="admin-field-grid">
                  <label className="field">
                    <span>상품 검색</span>
                    <input
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      onKeyDown={onProductSearchKeyDown}
                      placeholder="상품명으로 검색"
                    />
                  </label>
                  <label className="field">
                    <span>연결 상품 ID</span>
                    <input
                      type="number"
                      min={1}
                      value={form.productId}
                      onChange={(event) => updateField('productId', event.target.value === '' ? '' : Number(event.target.value))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                        }
                      }}
                      placeholder="상품 ID"
                    />
                  </label>
                  <div className="inline-actions">
                    <button className="button button-secondary" type="button" onClick={onSearchProducts} disabled={productsLoading}>
                      {productsLoading ? '검색 중...' : '상품 검색'}
                    </button>
                  </div>
                </div>

                <div className="admin-home-new-arrival-product-list" aria-label="상품 검색 결과">
                  {productOptions.map((product) => (
                    <button
                      className={`admin-home-new-arrival-product-option${form.productId === product.id ? ' is-selected' : ''}`}
                      key={product.id}
                      type="button"
                      onClick={() => onSelectProduct(product)}
                    >
                      <span className="admin-home-popup-list-thumb">
                        {product.thumbnailImageUrl ? <img src={product.thumbnailImageUrl} alt={`${product.name} 썸네일`} loading="lazy" /> : null}
                      </span>
                      <span>
                        <strong>{product.name}</strong>
                        <small>상품 ID {product.id}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="admin-form-section">
                <div className="admin-section-head">
                  <div>
                    <p className="section-kicker">Upload</p>
                    <h4 className="section-subtitle">홈 섹션 이미지</h4>
                  </div>
                  <div className="admin-inline-note">NEW는 전용 이미지가 필요하고, BEST는 비워두면 상품 썸네일을 사용합니다.</div>
                </div>

                <div className="admin-home-popup-upload-grid">
                  <label className={`admin-home-popup-file-picker${uploadReady ? ' is-selected' : ''}`} htmlFor="admin-home-new-arrival-file">
                    <span className="admin-home-popup-file-picker-kicker">Image Asset</span>
                    <strong>{selectedFile ? selectedFile.name : '홈 섹션 이미지를 선택하세요'}</strong>
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
                  id="admin-home-new-arrival-file"
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  aria-describedby="admin-home-new-arrival-upload-help"
                />

                <label className="field">
                  <span>홈 섹션 이미지 URL</span>
                  <input
                    value={form.imageUrl}
                    onChange={(event) => updateField('imageUrl', event.target.value)}
                    placeholder="https://..."
                    aria-describedby="admin-home-new-arrival-upload-help"
                  />
                </label>

                <p className="admin-inline-note admin-home-popup-upload-help" id="admin-home-new-arrival-upload-help">
                  BEST 항목에서 이미지 URL을 비워두면 연결 상품의 첫 번째 썸네일이 표시됩니다.
                </p>
              </section>
            </>
          ) : null}
        </section>

        <aside className="surface-card admin-card-stack admin-home-popup-preview-panel">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Preview</p>
              <h3 className="section-subtitle">홈 섹션 미리보기</h3>
            </div>
            <span className={`admin-home-popup-preview-badge${loading || form.isActive ? '' : ' is-muted'}`}>
              {loading ? '설정 확인 중' : form.isActive ? '노출 예정' : '비노출 예정'}
            </span>
          </div>

          {loading ? (
            <LoadingScreen mode="inline" title="미리보기 준비 중" message="저장된 항목을 확인하고 있습니다." />
          ) : (
            <>
              <div className="admin-home-new-arrival-preview-frame" aria-live="polite">
                {previewImageUrl !== '' ? (
                  <img src={previewImageUrl} alt={trimmedTitle || selectedProduct?.name || '홈 섹션 이미지'} />
                ) : (
                  <div className="admin-home-popup-preview-empty">
                    <strong>이미지 미리보기 준비 중</strong>
                    <p>이미지 URL을 입력하거나 연결 상품에 썸네일을 등록하면 이 영역에 이미지가 나타납니다.</p>
                  </div>
                )}
              </div>

              <div className="admin-home-popup-preview-summary">
                <div className="admin-summary-item">
                  <span>섹션</span>
                  <strong>{sectionLabel}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>제목</span>
                  <strong>{trimmedTitle !== '' ? trimmedTitle : '제목 없음'}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>연결 상품</span>
                  <strong>{selectedProduct ? selectedProduct.name : '미선택'}</strong>
                </div>
              </div>
            </>
          )}
        </aside>
      </form>
    </section>
  );
}
