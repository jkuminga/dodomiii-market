import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import {
  apiClient,
  AdminCategoryItem,
  AdminProductDetail,
  AdminProductImageInput,
  AdminProductOptionInput,
  AdminProductPayload,
} from '../../lib/api';
import {
  AdminLayoutContext,
  buildAdminCategoryOptions,
  formatAdminDateTime,
  formatCurrency,
  getAdminCategoryLabel,
} from './adminUtils';

type ProductImageDraft = {
  key: string;
  imageType: 'THUMBNAIL' | 'DETAIL';
  imageUrl: string;
  sortOrder: string;
};

type ProductOptionDraft = {
  key: string;
  optionGroupName: string;
  optionValue: string;
  extraPrice: string;
  isActive: boolean;
  sortOrder: string;
};

type ProductFormState = {
  categoryId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  basePrice: string;
  isVisible: boolean;
  isSoldOut: boolean;
  consultationRequired: boolean;
  stockQuantity: string;
  images: ProductImageDraft[];
  options: ProductOptionDraft[];
};

let draftSequence = 0;

function nextDraftKey(prefix: string): string {
  draftSequence += 1;
  return `${prefix}-${draftSequence}`;
}

function createImageDraft(imageType: 'THUMBNAIL' | 'DETAIL' = 'THUMBNAIL', sortOrder = '0'): ProductImageDraft {
  return {
    key: nextDraftKey('image'),
    imageType,
    imageUrl: '',
    sortOrder,
  };
}

function createOptionDraft(sortOrder = '0'): ProductOptionDraft {
  return {
    key: nextDraftKey('option'),
    optionGroupName: '',
    optionValue: '',
    extraPrice: '0',
    isActive: true,
    sortOrder,
  };
}

function createEmptyForm(): ProductFormState {
  return {
    categoryId: '',
    name: '',
    slug: '',
    shortDescription: '',
    description: '',
    basePrice: '',
    isVisible: true,
    isSoldOut: false,
    consultationRequired: false,
    stockQuantity: '',
    images: [],
    options: [],
  };
}

function formFromProduct(product: AdminProductDetail): ProductFormState {
  return {
    categoryId: String(product.category.id),
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    basePrice: String(product.basePrice),
    isVisible: product.isVisible,
    isSoldOut: product.isSoldOut,
    consultationRequired: product.consultationRequired,
    stockQuantity: product.stockQuantity === null ? '' : String(product.stockQuantity),
    images: product.images.map((image) => ({
      key: nextDraftKey('image'),
      imageType: image.imageType,
      imageUrl: image.imageUrl,
      sortOrder: String(image.sortOrder),
    })),
    options: product.options.map((option) => ({
      key: nextDraftKey('option'),
      optionGroupName: option.optionGroupName,
      optionValue: option.optionValue,
      extraPrice: String(option.extraPrice),
      isActive: option.isActive,
      sortOrder: String(option.sortOrder),
    })),
  };
}

function serializeFormState(form: ProductFormState): string {
  return JSON.stringify({
    categoryId: form.categoryId,
    name: form.name,
    slug: form.slug,
    shortDescription: form.shortDescription,
    description: form.description,
    basePrice: form.basePrice,
    isVisible: form.isVisible,
    isSoldOut: form.isSoldOut,
    consultationRequired: form.consultationRequired,
    stockQuantity: form.stockQuantity,
    images: form.images.map(({ imageType, imageUrl, sortOrder }) => ({
      imageType,
      imageUrl,
      sortOrder,
    })),
    options: form.options.map(({ optionGroupName, optionValue, extraPrice, isActive, sortOrder }) => ({
      optionGroupName,
      optionValue,
      extraPrice,
      isActive,
      sortOrder,
    })),
  });
}

function getNextSortOrder(items: Array<{ sortOrder: string }>): string {
  const maxOrder = items.reduce((max, item, index) => {
    const parsed = Number(item.sortOrder);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : Math.max(max, index);
  }, -1);

  return String(maxOrder + 1);
}

function moveDraftItem<T extends { sortOrder: string }>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const currentItem = items[index];
  const targetItem = items[targetIndex];
  const nextItems = [...items];

  nextItems[index] = {
    ...targetItem,
    sortOrder: currentItem.sortOrder,
  };
  nextItems[targetIndex] = {
    ...currentItem,
    sortOrder: targetItem.sortOrder,
  };

  return nextItems;
}

function SortArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg aria-hidden="true" className="admin-sort-icon" viewBox="0 0 24 24">
      {direction === 'up' ? (
        <>
          <path d="M12 18V7" />
          <path d="M7.5 11.5L12 7l4.5 4.5" />
        </>
      ) : (
        <>
          <path d="M12 6v11" />
          <path d="M7.5 12.5L12 17l4.5-4.5" />
        </>
      )}
    </svg>
  );
}

function buildPayload(form: ProductFormState): AdminProductPayload {
  const categoryId = Number(form.categoryId);
  const basePrice = Number(form.basePrice);
  const trimmedName = form.name.trim();
  const trimmedSlug = form.slug.trim();
  const stockQuantityText = form.stockQuantity.trim();

  if (!Number.isFinite(categoryId)) {
    throw new Error('카테고리를 선택해주세요.');
  }

  if (!trimmedName) {
    throw new Error('상품명을 입력해주세요.');
  }

  if (!trimmedSlug) {
    throw new Error('슬러그를 입력해주세요.');
  }

  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error('기본 가격은 0 이상의 숫자로 입력해주세요.');
  }

  const stockQuantity = stockQuantityText ? Number(stockQuantityText) : null;

  if (stockQuantityText && (!Number.isFinite(stockQuantity) || (stockQuantity ?? 0) < 0)) {
    throw new Error('재고 수량은 비워두거나 0 이상의 숫자로 입력해주세요.');
  }

  const images: AdminProductImageInput[] = form.images
    .filter((image) => image.imageUrl.trim() !== '')
    .map((image, index) => {
      const sortOrder = image.sortOrder.trim() ? Number(image.sortOrder) : index;

      if (!Number.isFinite(sortOrder)) {
        throw new Error('이미지 정렬 순서는 숫자로 입력해주세요.');
      }

      return {
        imageType: image.imageType,
        imageUrl: image.imageUrl.trim(),
        sortOrder,
      };
    });

  const options: AdminProductOptionInput[] = form.options
    .filter(
      (option) =>
        option.optionGroupName.trim() !== '' || option.optionValue.trim() !== '' || option.extraPrice.trim() !== '' || option.sortOrder.trim() !== '',
    )
    .map((option, index) => {
      if (!option.optionGroupName.trim() || !option.optionValue.trim()) {
        throw new Error('옵션을 입력할 때는 옵션 그룹명과 옵션 값을 모두 입력해주세요.');
      }

      const extraPrice = option.extraPrice.trim() ? Number(option.extraPrice) : 0;
      const sortOrder = option.sortOrder.trim() ? Number(option.sortOrder) : index;

      if (!Number.isFinite(extraPrice)) {
        throw new Error('옵션 추가 금액은 숫자로 입력해주세요.');
      }

      if (!Number.isFinite(sortOrder)) {
        throw new Error('옵션 정렬 순서는 숫자로 입력해주세요.');
      }

      return {
        optionGroupName: option.optionGroupName.trim(),
        optionValue: option.optionValue.trim(),
        extraPrice,
        isActive: option.isActive,
        sortOrder,
      };
    });

  return {
    categoryId,
    name: trimmedName,
    slug: trimmedSlug,
    shortDescription: form.shortDescription.trim() || null,
    description: form.description.trim() || null,
    basePrice,
    isVisible: form.isVisible,
    isSoldOut: form.isSoldOut,
    consultationRequired: form.consultationRequired,
    stockQuantity,
    images,
    options,
  };
}

export function AdminProductEditorPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { showToast } = useOutletContext<AdminLayoutContext>();

  const isCreateMode = !productId;

  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [form, setForm] = useState<ProductFormState>(createEmptyForm());
  const [initialSignature, setInitialSignature] = useState(() => serializeFormState(createEmptyForm()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedImageKey, setExpandedImageKey] = useState<string | null>(null);
  const [expandedOptionKey, setExpandedOptionKey] = useState<string | null>(null);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [newImage, setNewImage] = useState<ProductImageDraft>(() => createImageDraft('THUMBNAIL'));
  const [newOption, setNewOption] = useState<ProductOptionDraft>(() => createOptionDraft());

  const resetEditorPanels = (nextForm: ProductFormState) => {
    setExpandedImageKey(null);
    setExpandedOptionKey(null);
    setIsAddingImage(false);
    setIsAddingOption(false);
    setNewImage(createImageDraft(nextForm.images.length > 0 ? 'DETAIL' : 'THUMBNAIL', getNextSortOrder(nextForm.images)));
    setNewOption(createOptionDraft(getNextSortOrder(nextForm.options)));
  };

  const loadPage = async () => {
    setLoading(true);
    setError('');
    setProduct(null);

    try {
      const categoriesPromise = apiClient.getAdminCategories();

      if (isCreateMode) {
        const categoriesResult = await categoriesPromise;
        const nextForm = createEmptyForm();
        setCategories(categoriesResult.items);
        setProduct(null);
        setForm(nextForm);
        setInitialSignature(serializeFormState(nextForm));
        resetEditorPanels(nextForm);
      } else if (productId) {
        const [categoriesResult, productResult] = await Promise.all([categoriesPromise, apiClient.getAdminProductById(productId)]);
        const nextForm = formFromProduct(productResult);
        setCategories(categoriesResult.items);
        setProduct(productResult);
        setForm(nextForm);
        setInitialSignature(serializeFormState(nextForm));
        resetEditorPanels(nextForm);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '상품 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, [isCreateMode, productId]);

  const categoryOptions = useMemo(() => buildAdminCategoryOptions(categories), [categories]);
  const previewCategoryId = form.categoryId ? Number(form.categoryId) : product?.category.id;
  const previewCategoryLabel = Number.isFinite(previewCategoryId) ? getAdminCategoryLabel(previewCategoryId, categories) : '카테고리 미선택';
  const hasUnsavedChanges = useMemo(() => serializeFormState(form) !== initialSignature, [form, initialSignature]);
  const configuredImageCount = useMemo(
    () => form.images.filter((image) => image.imageUrl.trim() !== '').length,
    [form.images],
  );
  const configuredOptionCount = useMemo(
    () => form.options.filter((option) => option.optionGroupName.trim() !== '' && option.optionValue.trim() !== '').length,
    [form.options],
  );
  const activeOptionCount = useMemo(() => form.options.filter((option) => option.isActive).length, [form.options]);

  const replaceImage = (key: string, patch: Partial<ProductImageDraft>) => {
    setForm((current) => ({
      ...current,
      images: current.images.map((image) => (image.key === key ? { ...image, ...patch } : image)),
    }));
  };

  const removeImage = (key: string) => {
    setForm((current) => ({
      ...current,
      images: current.images.filter((image) => image.key !== key),
    }));
    setExpandedImageKey((current) => (current === key ? null : current));
  };

  const moveImage = (key: string, direction: 'up' | 'down') => {
    setForm((current) => {
      const index = current.images.findIndex((image) => image.key === key);

      if (index < 0) {
        return current;
      }

      return {
        ...current,
        images: moveDraftItem(current.images, index, direction),
      };
    });
  };

  const replaceOption = (key: string, patch: Partial<ProductOptionDraft>) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option) => (option.key === key ? { ...option, ...patch } : option)),
    }));
  };

  const removeOption = (key: string) => {
    setForm((current) => ({
      ...current,
      options: current.options.filter((option) => option.key !== key),
    }));
    setExpandedOptionKey((current) => (current === key ? null : current));
  };

  const moveOption = (key: string, direction: 'up' | 'down') => {
    setForm((current) => {
      const index = current.options.findIndex((option) => option.key === key);

      if (index < 0) {
        return current;
      }

      return {
        ...current,
        options: moveDraftItem(current.options, index, direction),
      };
    });
  };

  const toggleImageAddPanel = () => {
    setIsAddingImage((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setExpandedImageKey(null);
        setNewImage(createImageDraft(form.images.length > 0 ? 'DETAIL' : 'THUMBNAIL', getNextSortOrder(form.images)));
      }

      return nextOpen;
    });
  };

  const toggleOptionAddPanel = () => {
    setIsAddingOption((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setExpandedOptionKey(null);
        setNewOption(createOptionDraft(getNextSortOrder(form.options)));
      }

      return nextOpen;
    });
  };

  const commitNewImage = () => {
    if (!newImage.imageUrl.trim()) {
      setError('추가할 이미지 URL을 입력해주세요.');
      return;
    }

    setError('');
    setForm((current) => ({
      ...current,
      images: [...current.images, newImage],
    }));
    setExpandedImageKey(newImage.key);
    setIsAddingImage(false);
    setNewImage(createImageDraft('DETAIL', getNextSortOrder([...form.images, newImage])));
  };

  const commitNewOption = () => {
    if (!newOption.optionGroupName.trim() || !newOption.optionValue.trim()) {
      setError('옵션 그룹명과 옵션 값을 입력해주세요.');
      return;
    }

    if (newOption.extraPrice.trim() && !Number.isFinite(Number(newOption.extraPrice))) {
      setError('옵션 추가 금액은 숫자로 입력해주세요.');
      return;
    }

    setError('');
    setForm((current) => ({
      ...current,
      options: [...current.options, newOption],
    }));
    setExpandedOptionKey(newOption.key);
    setIsAddingOption(false);
    setNewOption(createOptionDraft(getNextSortOrder([...form.options, newOption])));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = buildPayload(form);

      if (isCreateMode) {
        const created = await apiClient.createAdminProduct(payload);
        showToast('상품을 생성했습니다.');
        navigate(`/admin/products/${created.id}`, { replace: true });
        return;
      }

      if (!productId) {
        throw new Error('상품 식별자가 없습니다.');
      }

      await apiClient.updateAdminProduct(productId, payload);
      showToast('상품 정보를 저장했습니다.');
      await loadPage();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '상품 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!productId) {
      return;
    }

    const confirmed = window.confirm(`'${product?.name ?? '현재 상품'}'을 삭제하시겠습니까?`);

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      await apiClient.deleteAdminProduct(productId);
      showToast('상품을 삭제했습니다.');
      navigate('/admin/products', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '상품 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isCreateMode && !productId) {
    return <Navigate to="/admin/products" replace />;
  }

  if (loading) {
    return (
      <section className="admin-section">
        <section className="surface-card status-card">
          <p className="section-kicker">Loading</p>
          <h2 className="section-subtitle">상품 정보를 준비하는 중</h2>
          <p className="feedback-copy">카테고리와 상품 상세 데이터를 불러오고 있습니다.</p>
        </section>
      </section>
    );
  }

  if (error && !isCreateMode && !product) {
    return (
      <section className="admin-section">
        <section className="surface-card status-card">
          <p className="section-kicker">Unavailable</p>
          <h2 className="section-subtitle">상품을 불러올 수 없습니다</h2>
          <p className="feedback-copy is-error">{error}</p>
          <Link className="button button-secondary" to="/admin/products">
            목록으로 돌아가기
          </Link>
        </section>
      </section>
    );
  }

  if (!isCreateMode && !product) {
    return (
      <section className="admin-section">
        <section className="surface-card status-card">
          <p className="section-kicker">Empty</p>
          <h2 className="section-subtitle">상품 데이터를 찾을 수 없습니다</h2>
          <p className="feedback-copy">삭제되었거나 아직 상세 정보가 준비되지 않았습니다.</p>
          <Link className="button button-secondary" to="/admin/products">
            목록으로 돌아가기
          </Link>
        </section>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">{isCreateMode ? 'Create Product' : 'Edit Product'}</p>
          <h2 className="section-title admin-section-title">{isCreateMode ? '상품 등록' : '상품 상세 / 수정'}</h2>
          {/* <p className="section-copy">
            긴 입력 행 나열 대신 구성 요소를 카드 리스트로 먼저 확인하고, 필요한 항목만 펼쳐서 수정할 수 있게 편집 흐름을 정리했습니다.
          </p> */}
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>카테고리</span>
            <strong>{previewCategoryLabel}</strong>
          </div>
          <div className="admin-stat-card">
            <span>기본가</span>
            <strong>{form.basePrice ? formatCurrency(Number(form.basePrice)) : '-'}</strong>
          </div>
          <div className="admin-stat-card">
            <span>이미지 / 옵션</span>
            <strong>
              {form.images.length} / {form.options.length}
            </strong>
          </div>
          <div className="admin-stat-card">
            <span>작업 상태</span>
            <strong>{hasUnsavedChanges ? '변경됨' : '저장됨'}</strong>
          </div>
        </div>
      </section>

      <div className="admin-two-column admin-product-editor-grid">
        <form className="surface-card admin-card-stack admin-editor-card" onSubmit={onSubmit}>
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Editor</p>
              <h3 className="section-subtitle">기본 정보</h3>
            </div>
            <div className="inline-actions">
              <Link className="button button-secondary" to="/admin/products">
                목록
              </Link>
              {!isCreateMode ? (
                <Link className="button button-ghost" to={`/products/${productId ?? ''}`}>
                  스토어 보기
                </Link>
              ) : null}
            </div>
          </div>

          <section className="admin-editor-overview-bar" aria-label="편집 요약">
            <div className="admin-overview-chip">
              <span>이미지</span>
              <strong>{form.images.length}</strong>
              <small>{configuredImageCount}개 구성 완료</small>
            </div>
            <div className="admin-overview-chip">
              <span>옵션</span>
              <strong>{form.options.length}</strong>
              <small>{activeOptionCount}개 활성</small>
            </div>
            <div className="admin-overview-chip">
              <span>변경 상태</span>
              <strong>{hasUnsavedChanges ? '변경됨' : '저장됨'}</strong>
              <small>{hasUnsavedChanges ? '저장 전 변경사항이 있습니다.' : '마지막 불러오기 기준과 동일합니다.'}</small>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-field-grid">
              <label className="field">
                <span>카테고리</span>
                <select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                  <option value="">선택</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>상품명</span>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </label>

              <label className="field">
                <span>슬러그</span>
                <input
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="moru-tulip-bouquet"
                />
              </label>

              <label className="field">
                <span>기본 가격</span>
                <input
                  type="number"
                  min="0"
                  value={form.basePrice}
                  onChange={(event) => setForm((current) => ({ ...current, basePrice: event.target.value }))}
                />
              </label>

              <label className="field admin-field-span-2">
                <span>짧은 소개</span>
                <input
                  value={form.shortDescription}
                  onChange={(event) => setForm((current) => ({ ...current, shortDescription: event.target.value }))}
                  placeholder="목록 카드에 노출할 설명"
                />
              </label>

              <label className="field admin-field-span-2">
                <span>상세 설명</span>
                <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </label>

              <label className="field">
                <span>재고 수량</span>
                <input
                  type="number"
                  min="0"
                  value={form.stockQuantity}
                  onChange={(event) => setForm((current) => ({ ...current, stockQuantity: event.target.value }))}
                  placeholder="비워두면 재고 추적 안 함"
                />
              </label>
            </div>

            <div className="admin-check-grid">
              <label className="admin-check-field">
                <input
                  type="checkbox"
                  checked={form.isVisible}
                  onChange={(event) => setForm((current) => ({ ...current, isVisible: event.target.checked }))}
                />
                <span>스토어 노출</span>
              </label>
              <label className="admin-check-field">
                <input
                  type="checkbox"
                  checked={form.isSoldOut}
                  onChange={(event) => setForm((current) => ({ ...current, isSoldOut: event.target.checked }))}
                />
                <span>품절 처리</span>
              </label>
              <label className="admin-check-field">
                <input
                  type="checkbox"
                  checked={form.consultationRequired}
                  onChange={(event) => setForm((current) => ({ ...current, consultationRequired: event.target.checked }))}
                />
                <span>상담 필요</span>
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Images</p>
                <h3 className="section-subtitle">이미지</h3>
              </div>
              <button className="button button-secondary" type="button" onClick={toggleImageAddPanel}>
                {isAddingImage ? '추가 닫기' : '이미지 추가'}
              </button>
            </div>

            {isAddingImage ? (
              <section className="admin-subcard admin-creator-panel">
                <div className="admin-panel-head">
                  <div>
                    <strong>새 이미지 추가</strong>
                    <p>미니 패널에서 값을 먼저 입력한 뒤 리스트에 반영합니다.</p>
                  </div>
                </div>

                <div className="admin-field-grid">
                  <label className="field">
                    <span>이미지 타입</span>
                    <select value={newImage.imageType} onChange={(event) => setNewImage((current) => ({ ...current, imageType: event.target.value as 'THUMBNAIL' | 'DETAIL' }))}>
                      <option value="THUMBNAIL">썸네일</option>
                      <option value="DETAIL">상세</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>정렬 순서</span>
                    <input
                      type="number"
                      value={newImage.sortOrder}
                      onChange={(event) => setNewImage((current) => ({ ...current, sortOrder: event.target.value }))}
                    />
                  </label>

                  <label className="field admin-field-span-2">
                    <span>이미지 URL</span>
                    <input
                      value={newImage.imageUrl}
                      onChange={(event) => setNewImage((current) => ({ ...current, imageUrl: event.target.value }))}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className="inline-actions">
                  <button className="button" type="button" onClick={commitNewImage}>
                    리스트에 추가
                  </button>
                  <button className="button button-ghost" type="button" onClick={toggleImageAddPanel}>
                    취소
                  </button>
                </div>
              </section>
            ) : null}

            {form.images.length === 0 ? (
              <section className="admin-empty-state admin-collection-empty">
                <p className="section-kicker">Empty</p>
                <h4 className="section-subtitle">등록된 이미지가 없습니다</h4>
                <p className="section-copy">이미지는 필요한 시점에만 추가하고, 카드 하나씩 펼쳐 수정할 수 있습니다.</p>
              </section>
            ) : (
              <div className="admin-repeatable-grid">
                {form.images.map((image, index) => {
                  const isExpanded = expandedImageKey === image.key;

                  return (
                    <article className={`admin-list-card admin-editor-list-card ${isExpanded ? 'is-active' : ''}`} key={image.key}>
                      <div className="admin-item-card-shell">
                        <button
                          className="admin-item-toggle"
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={`admin-image-panel-${image.key}`}
                          onClick={() => {
                            setIsAddingImage(false);
                            setExpandedImageKey((current) => (current === image.key ? null : image.key));
                          }}
                        >
                          <div className="admin-item-preview media-preview">
                            {image.imageUrl.trim() ? <img src={image.imageUrl} alt="" /> : <span>No Image</span>}
                          </div>
                          <div className="admin-item-copy">
                            <div className="admin-list-card-head">
                              <div>
                                <strong>
                                  {index + 1}. {image.imageType === 'THUMBNAIL' ? '썸네일 이미지' : '상세 이미지'}
                                </strong>
                                {/* <p>{image.imageUrl.trim() ? '미리보기 중심 카드입니다. URL은 편집 패널에서만 수정할 수 있습니다.' : '이미지 URL을 입력하면 카드에 미리보기가 표시됩니다.'}</p> */}
                              </div>
                              <span className={`status-pill ${image.imageUrl.trim() ? '' : 'is-muted'}`}>
                                {image.imageUrl.trim() ? '준비됨' : '미완료'}
                              </span>
                            </div>
                            <div className="admin-meta-row">
                              <span>정렬 {image.sortOrder || '-'}</span>
                              <span>{image.imageType === 'THUMBNAIL' ? '대표 이미지 슬롯' : '상세 이미지 슬롯'}</span>
                              <span>{isExpanded ? '편집 패널 열림' : '접힘'}</span>
                            </div>
                          </div>
                        </button>

                        <div className="admin-item-actions">
                          <button
                            aria-label="이미지 위로 이동"
                            className="button button-ghost admin-sort-icon-button"
                            type="button"
                            title="이미지 위로 이동"
                            onClick={() => moveImage(image.key, 'up')}
                            disabled={index === 0}
                          >
                            <SortArrowIcon direction="up" />
                          </button>
                          <button
                            aria-label="이미지 아래로 이동"
                            className="button button-ghost admin-sort-icon-button"
                            type="button"
                            title="이미지 아래로 이동"
                            onClick={() => moveImage(image.key, 'down')}
                            disabled={index === form.images.length - 1}
                          >
                            <SortArrowIcon direction="down" />
                          </button>
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => {
                              setIsAddingImage(false);
                              setExpandedImageKey((current) => (current === image.key ? null : image.key));
                            }}
                          >
                            {isExpanded ? '접기' : '편집'}
                          </button>
                          <button className="button button-ghost" type="button" onClick={() => removeImage(image.key)}>
                            삭제
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="admin-item-editor" id={`admin-image-panel-${image.key}`}>
                          <div className="admin-field-grid">
                            <label className="field">
                              <span>이미지 타입</span>
                              <select value={image.imageType} onChange={(event) => replaceImage(image.key, { imageType: event.target.value as 'THUMBNAIL' | 'DETAIL' })}>
                                <option value="THUMBNAIL">썸네일</option>
                                <option value="DETAIL">상세</option>
                              </select>
                            </label>

                            <label className="field">
                              <span>정렬 순서</span>
                              <input
                                type="number"
                                value={image.sortOrder}
                                onChange={(event) => replaceImage(image.key, { sortOrder: event.target.value })}
                              />
                            </label>

                            <label className="field admin-field-span-2">
                              <span>이미지 URL</span>
                              <input value={image.imageUrl} onChange={(event) => replaceImage(image.key, { imageUrl: event.target.value })} />
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="admin-form-section">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Options</p>
                <h3 className="section-subtitle">옵션</h3>
              </div>
              <button className="button button-secondary" type="button" onClick={toggleOptionAddPanel}>
                {isAddingOption ? '추가 닫기' : '옵션 추가'}
              </button>
            </div>

            {isAddingOption ? (
              <section className="admin-subcard admin-creator-panel">
                <div className="admin-panel-head">
                  <div>
                    <strong>새 옵션 추가</strong>
                    <p>옵션을 완성해서 저장하면 요약 카드 리스트에 바로 반영됩니다.</p>
                  </div>
                </div>

                <div className="admin-field-grid">
                  <label className="field">
                    <span>옵션 그룹</span>
                    <input
                      value={newOption.optionGroupName}
                      onChange={(event) => setNewOption((current) => ({ ...current, optionGroupName: event.target.value }))}
                      placeholder="색상"
                    />
                  </label>

                  <label className="field">
                    <span>옵션 값</span>
                    <input
                      value={newOption.optionValue}
                      onChange={(event) => setNewOption((current) => ({ ...current, optionValue: event.target.value }))}
                      placeholder="핑크"
                    />
                  </label>

                  <label className="field">
                    <span>추가 금액</span>
                    <input
                      type="number"
                      value={newOption.extraPrice}
                      onChange={(event) => setNewOption((current) => ({ ...current, extraPrice: event.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span>정렬 순서</span>
                    <input
                      type="number"
                      value={newOption.sortOrder}
                      onChange={(event) => setNewOption((current) => ({ ...current, sortOrder: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="inline-actions">
                  <label className="admin-check-field admin-check-field-inline">
                    <input
                      type="checkbox"
                      checked={newOption.isActive}
                      onChange={(event) => setNewOption((current) => ({ ...current, isActive: event.target.checked }))}
                    />
                    <span>활성 옵션</span>
                  </label>
                </div>

                <div className="inline-actions">
                  <button className="button" type="button" onClick={commitNewOption}>
                    리스트에 추가
                  </button>
                  <button className="button button-ghost" type="button" onClick={toggleOptionAddPanel}>
                    취소
                  </button>
                </div>
              </section>
            ) : null}

            {form.options.length === 0 ? (
              <section className="admin-empty-state admin-collection-empty">
                <p className="section-kicker">Empty</p>
                <h4 className="section-subtitle">등록된 옵션이 없습니다</h4>
                <p className="section-copy">옵션이 필요할 때만 추가하고, 기본은 모두 접힌 상태로 유지됩니다.</p>
              </section>
            ) : (
              <div className="admin-repeatable-grid">
                {form.options.map((option, index) => {
                  const isExpanded = expandedOptionKey === option.key;
                  const extraPrice = Number(option.extraPrice || '0');
                  const extraPriceLabel = Number.isFinite(extraPrice)
                    ? extraPrice === 0
                      ? '추가 금액 없음'
                      : `${extraPrice > 0 ? '+' : ''}${formatCurrency(extraPrice)}`
                    : '금액 확인 필요';

                  return (
                    <article className={`admin-list-card admin-editor-list-card ${isExpanded ? 'is-active' : ''}`} key={option.key}>
                      <div className="admin-item-card-shell">
                        <button
                          className="admin-item-toggle"
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={`admin-option-panel-${option.key}`}
                          onClick={() => {
                            setIsAddingOption(false);
                            setExpandedOptionKey((current) => (current === option.key ? null : option.key));
                          }}
                        >
                          <div className="admin-item-copy">
                            <div className="admin-list-card-head">
                              <div>
                                <strong>
                                  {index + 1}. {option.optionGroupName.trim() || '옵션 그룹 미입력'}
                                </strong>
                                <p>{option.optionValue.trim() || '옵션 값 미입력'}</p>
                              </div>
                              <span className={`status-pill ${option.isActive ? '' : 'is-muted'}`}>{option.isActive ? '활성' : '비활성'}</span>
                            </div>
                            <div className="admin-product-summary">
                              <span>{extraPriceLabel}</span>
                              <span>정렬 {option.sortOrder || '-'}</span>
                            </div>
                          </div>
                        </button>

                        <div className="admin-item-actions">
                          <button
                            aria-label="옵션 위로 이동"
                            className="button button-ghost admin-sort-icon-button"
                            type="button"
                            title="옵션 위로 이동"
                            onClick={() => moveOption(option.key, 'up')}
                            disabled={index === 0}
                          >
                            <SortArrowIcon direction="up" />
                          </button>
                          <button
                            aria-label="옵션 아래로 이동"
                            className="button button-ghost admin-sort-icon-button"
                            type="button"
                            title="옵션 아래로 이동"
                            onClick={() => moveOption(option.key, 'down')}
                            disabled={index === form.options.length - 1}
                          >
                            <SortArrowIcon direction="down" />
                          </button>
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => {
                              setIsAddingOption(false);
                              setExpandedOptionKey((current) => (current === option.key ? null : option.key));
                            }}
                          >
                            {isExpanded ? '접기' : '편집'}
                          </button>
                          <button className="button button-ghost" type="button" onClick={() => removeOption(option.key)}>
                            삭제
                          </button>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="admin-item-editor" id={`admin-option-panel-${option.key}`}>
                          <div className="admin-field-grid">
                            <label className="field">
                              <span>옵션 그룹</span>
                              <input
                                value={option.optionGroupName}
                                onChange={(event) => replaceOption(option.key, { optionGroupName: event.target.value })}
                                placeholder="색상"
                              />
                            </label>

                            <label className="field">
                              <span>옵션 값</span>
                              <input
                                value={option.optionValue}
                                onChange={(event) => replaceOption(option.key, { optionValue: event.target.value })}
                                placeholder="핑크"
                              />
                            </label>

                            <label className="field">
                              <span>추가 금액</span>
                              <input
                                type="number"
                                value={option.extraPrice}
                                onChange={(event) => replaceOption(option.key, { extraPrice: event.target.value })}
                              />
                            </label>

                            <label className="field">
                              <span>정렬 순서</span>
                              <input
                                type="number"
                                value={option.sortOrder}
                                onChange={(event) => replaceOption(option.key, { sortOrder: event.target.value })}
                              />
                            </label>
                          </div>

                          <div className="inline-actions">
                            <label className="admin-check-field admin-check-field-inline">
                              <input
                                type="checkbox"
                                checked={option.isActive}
                                onChange={(event) => replaceOption(option.key, { isActive: event.target.checked })}
                              />
                              <span>활성 옵션</span>
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {error ? (
            <p className="feedback-copy is-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="inline-actions">
            <button className="button" type="submit" disabled={submitting || deleting}>
              {submitting ? '저장 중...' : isCreateMode ? '상품 생성' : '저장'}
            </button>
            {!isCreateMode ? (
              <button className="button button-ghost" type="button" onClick={() => void onDelete()} disabled={submitting || deleting}>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            ) : null}
          </div>
        </form>

        <section className="surface-card admin-card-stack admin-editor-summary-panel">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Summary</p>
              <h3 className="section-subtitle">운영 요약</h3>
            </div>
            {!isCreateMode && product ? <span className="admin-inline-note">ID {product.id}</span> : null}
          </div>

          <div className="admin-summary-grid">
            <div className="admin-summary-item">
              <span>카테고리</span>
              <strong>{previewCategoryLabel}</strong>
            </div>
            <div className="admin-summary-item">
              <span>기본 가격</span>
              <strong>{form.basePrice ? formatCurrency(Number(form.basePrice)) : '-'}</strong>
            </div>
            <div className="admin-summary-item">
              <span>재고</span>
              <strong>{form.stockQuantity ? `${form.stockQuantity}개` : '재고 추적 안 함'}</strong>
            </div>
            <div className="admin-summary-item">
              <span>변경 상태</span>
              <strong>{hasUnsavedChanges ? '저장 필요' : '최신 상태'}</strong>
            </div>
          </div>

          <div className="admin-pill-row">
            <span className={`status-pill ${form.isVisible ? '' : 'is-muted'}`}>{form.isVisible ? '노출' : '숨김'}</span>
            <span className={`status-pill ${form.isSoldOut ? 'is-muted' : ''}`}>{form.isSoldOut ? '품절' : '판매중'}</span>
            <span className={`status-pill ${form.consultationRequired ? '' : 'is-muted'}`}>{form.consultationRequired ? '상담 필요' : '일반 주문'}</span>
            {product?.deletedAt ? <span className="status-pill is-muted">삭제됨</span> : null}
          </div>

          {product ? (
            <>
              <div className="admin-summary-grid">
                <div className="admin-summary-item">
                  <span>생성 일시</span>
                  <strong>{formatAdminDateTime(product.createdAt)}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>수정 일시</span>
                  <strong>{formatAdminDateTime(product.updatedAt)}</strong>
                </div>
              </div>

              <section className="admin-subcard">
                <p className="section-kicker">Operations</p>
                <div className="admin-summary-grid">
                  <div className="admin-summary-item">
                    <span>카테고리 슬러그</span>
                    <strong>{product.category.slug}</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>주문 반영 수</span>
                    <strong>{product.orderItemCount}건</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>카테고리 노출</span>
                    <strong>{product.category.isVisible ? '노출' : '숨김'}</strong>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <p className="feedback-copy">생성 후에는 정책 정보와 실제 반영 결과를 이 영역에서 함께 확인할 수 있습니다.</p>
          )}

          <section className="admin-subcard">
            <p className="section-kicker">Draft Snapshot</p>
            <div className="admin-summary-grid">
              <div className="admin-summary-item">
                <span>이미지</span>
                <strong>{configuredImageCount}개 준비됨</strong>
              </div>
              <div className="admin-summary-item">
                <span>옵션</span>
                <strong>{configuredOptionCount}개 구성됨</strong>
              </div>
              <div className="admin-summary-item">
                <span>활성 옵션</span>
                <strong>{activeOptionCount}개</strong>
              </div>
              <div className="admin-summary-item">
                <span>기준 시점</span>
                <strong>{product ? formatAdminDateTime(product.updatedAt) : '새 초안'}</strong>
              </div>
            </div>
          </section>
        </section>
      </div>
    </section>
  );
}
