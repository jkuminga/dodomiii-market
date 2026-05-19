import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { AdminFloatingSubmitButton } from '../../components/admin/AdminFloatingSubmitButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import {
  apiClient,
  AdminCategoryItem,
  AdminProductDetail,
  AdminProductOptionGroupInput,
  AdminProductImageInput,
  AdminProductPayload,
} from '../../lib/api';
import { calculateDiscountedPrice, formatDiscountRate } from '../../lib/productPricing';
import { ProductContentEditor } from './product-editor/ProductContentEditor';
import {
  buildProductContent,
  createParagraphBlock,
  productContentBlocksFromContent,
  productContentPlainText,
  ProductContentBlockDraft,
} from './product-editor/productContentTypes';
import {
  AdminLayoutContext,
  buildAdminCategoryOptions,
  formatAdminDateTime,
  formatCurrency,
  getAdminCategoryLabel,
} from './adminUtils';

type ProductImageDraft = {
  key: string;
  imageUrl: string;
  sortOrder: string;
};

type ProductOptionDraft = {
  key: string;
  optionGroupName: string;
  optionValue: string;
  selectionType: 'SINGLE' | 'QUANTITY';
  isRequired: boolean;
  extraPrice: string;
  maxQuantity: string;
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
  discountRate: string;
  isVisible: boolean;
  isSoldOut: boolean;
  consultationRequired: boolean;
  contentBlocks: ProductContentBlockDraft[];
  images: ProductImageDraft[];
  options: ProductOptionDraft[];
};

const FLOATING_SUBMIT_SUCCESS_MS = 700;

let draftSequence = 0;

function nextDraftKey(prefix: string): string {
  draftSequence += 1;
  return `${prefix}-${draftSequence}`;
}

function createImageDraft(sortOrder = '0'): ProductImageDraft {
  return {
    key: nextDraftKey('image'),
    imageUrl: '',
    sortOrder,
  };
}

function createOptionDraft(sortOrder = '0'): ProductOptionDraft {
  return {
    key: nextDraftKey('option'),
    optionGroupName: '',
    optionValue: '',
    selectionType: 'SINGLE',
    isRequired: false,
    extraPrice: '0',
    maxQuantity: '',
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
    discountRate: '0',
    isVisible: true,
    isSoldOut: false,
    consultationRequired: false,
    contentBlocks: [createParagraphBlock()],
    images: [],
    options: [],
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

function formFromProduct(product: AdminProductDetail): ProductFormState {
  return {
    categoryId: String(product.category.id),
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    basePrice: String(product.basePrice),
    discountRate: String(product.discountRate),
    isVisible: product.isVisible,
    isSoldOut: product.isSoldOut,
    consultationRequired: product.consultationRequired,
    contentBlocks: productContentBlocksFromContent(product.contentJson ?? null).map((block) => {
      if (product.contentJson || block.type !== 'paragraph' || block.text.trim()) {
        return block;
      }

      return {
        ...block,
        text: product.description ?? '',
      };
    }),
    images: product.images.map((image) => ({
      key: nextDraftKey('image'),
      imageUrl: image.imageUrl,
      sortOrder: String(image.sortOrder),
    })),
    options: product.optionGroups.flatMap((group) =>
      group.options.map((option) => ({
        key: nextDraftKey('option'),
        optionGroupName: group.name,
        optionValue: option.name,
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        extraPrice: String(option.extraPrice),
        maxQuantity: option.maxQuantity === null ? '' : String(option.maxQuantity),
        isActive: option.isActive,
        sortOrder: String(option.sortOrder),
      })),
    ),
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
    discountRate: form.discountRate,
    isVisible: form.isVisible,
    isSoldOut: form.isSoldOut,
    consultationRequired: form.consultationRequired,
    contentJson: buildProductContent(form.contentBlocks),
    images: form.images.map(({ imageUrl, sortOrder }) => ({
      imageUrl,
      sortOrder,
    })),
    options: form.options.map(({ optionGroupName, optionValue, selectionType, isRequired, extraPrice, maxQuantity, isActive, sortOrder }) => ({
      optionGroupName,
      optionValue,
      selectionType,
      isRequired,
      extraPrice,
      maxQuantity,
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

function reorderDraftItems<T extends { key: string; sortOrder: string }>(items: T[], sourceKey: string, targetKey: string): T[] {
  const sourceIndex = items.findIndex((item) => item.key === sourceKey);
  const targetIndex = items.findIndex((item) => item.key === targetKey);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return items;
  }

  const reordered = [...items];
  const [moved] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, moved);

  return reordered.map((item, index) => ({
    ...item,
    sortOrder: String(index),
  }));
}

function buildImageInputsFromDrafts(images: ProductImageDraft[]): AdminProductImageInput[] {
  return images
    .filter((image) => image.imageUrl.trim() !== '')
    .map((image, index) => {
      const sortOrder = image.sortOrder.trim() ? Number(image.sortOrder) : index;

      if (!Number.isFinite(sortOrder)) {
        throw new Error('이미지 정렬 순서는 숫자로 입력해주세요.');
      }

      return {
        imageUrl: image.imageUrl.trim(),
        sortOrder,
      };
    });
}

function sortImageDrafts(images: ProductImageDraft[]): ProductImageDraft[] {
  return [...images].sort((left, right) => {
    const leftOrder = Number(left.sortOrder);
    const rightOrder = Number(right.sortOrder);
    const normalizedLeft = Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER;
    const normalizedRight = Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return left.key.localeCompare(right.key);
  });
}

function buildOptionGroupInputsFromDrafts(options: ProductOptionDraft[]): AdminProductOptionGroupInput[] {
  const normalizedOptions = options
    .filter(
      (option) =>
        option.optionGroupName.trim() !== '' ||
        option.optionValue.trim() !== '' ||
        option.extraPrice.trim() !== '' ||
        option.maxQuantity.trim() !== '' ||
        option.sortOrder.trim() !== '',
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

      const maxQuantity =
        option.maxQuantity.trim() === ''
          ? null
          : Number(option.maxQuantity);

      if (option.maxQuantity.trim() !== '' && (!Number.isFinite(maxQuantity) || (maxQuantity ?? 0) < 1)) {
        throw new Error('옵션 최대 수량은 비워두거나 1 이상의 숫자로 입력해주세요.');
      }

      if (!Number.isFinite(sortOrder)) {
        throw new Error('옵션 정렬 순서는 숫자로 입력해주세요.');
      }

      return {
        optionGroupName: option.optionGroupName.trim(),
        optionValue: option.optionValue.trim(),
        selectionType: option.selectionType,
        isRequired: option.isRequired,
        extraPrice,
        maxQuantity,
        isActive: option.isActive,
        sortOrder,
      };
    });

  const groupMap = new Map<string, AdminProductOptionGroupInput>();

  normalizedOptions.forEach((option, index) => {
    const existingGroup = groupMap.get(option.optionGroupName);

    if (!existingGroup) {
      groupMap.set(option.optionGroupName, {
        name: option.optionGroupName,
        selectionType: option.selectionType,
        isRequired: option.isRequired,
        isActive: true,
        sortOrder: index,
        options: [
          {
            name: option.optionValue,
            extraPrice: option.extraPrice,
            maxQuantity: option.maxQuantity,
            isActive: option.isActive,
            sortOrder: option.sortOrder,
          },
        ],
      });
      return;
    }

    if (existingGroup.selectionType !== option.selectionType || existingGroup.isRequired !== option.isRequired) {
      throw new Error(`같은 옵션 그룹(${option.optionGroupName})은 동일한 선택 방식과 필수 여부를 가져야 합니다.`);
    }

    existingGroup.options.push({
      name: option.optionValue,
      extraPrice: option.extraPrice,
      maxQuantity: option.maxQuantity,
      isActive: option.isActive,
      sortOrder: option.sortOrder,
    });
  });

  return [...groupMap.values()];
}

function buildOrderSignature(items: Array<{ key: string; sortOrder: string }>): string {
  return JSON.stringify(
    items.map((item) => ({
      key: item.key,
      sortOrder: item.sortOrder,
    })),
  );
}

function buildPayload(form: ProductFormState): AdminProductPayload {
  const categoryId = Number(form.categoryId);
  const basePrice = Number(form.basePrice);
  const discountRateText = form.discountRate.trim();
  const trimmedName = form.name.trim();
  const trimmedSlug = form.slug.trim();

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

  const discountRate = discountRateText ? Number(discountRateText) : 0;

  if (discountRateText && (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100)) {
    throw new Error('할인율은 0부터 100 사이의 숫자로 입력해주세요.');
  }

  const images = buildImageInputsFromDrafts(sortImageDrafts(form.images));
  const optionGroups = buildOptionGroupInputsFromDrafts(form.options);
  const hasUploadingContentImage = form.contentBlocks.some((block) => block.type === 'image' && block.isUploading);
  const contentJson = buildProductContent(form.contentBlocks);
  const contentPlainText = productContentPlainText(form.contentBlocks);

  if (hasUploadingContentImage) {
    throw new Error('상품 상세 본문 이미지 업로드가 끝난 뒤 저장해주세요.');
  }

  return {
    categoryId,
    name: trimmedName,
    slug: trimmedSlug,
    shortDescription: form.shortDescription.trim() || null,
    description: contentPlainText || form.description.trim() || null,
    contentJson,
    basePrice,
    discountRate,
    isVisible: form.isVisible,
    isSoldOut: form.isSoldOut,
    consultationRequired: form.consultationRequired,
    images,
    optionGroups,
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
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedImageKey, setExpandedImageKey] = useState<string | null>(null);
  const [expandedOptionKey, setExpandedOptionKey] = useState<string | null>(null);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [newImage, setNewImage] = useState<ProductImageDraft>(() => createImageDraft());
  const [newOption, setNewOption] = useState<ProductOptionDraft>(() => createOptionDraft());
  const [savedImageOrderSignature, setSavedImageOrderSignature] = useState('[]');
  const [savedOptionOrderSignature, setSavedOptionOrderSignature] = useState('[]');
  const [applyingImageOrder, setApplyingImageOrder] = useState(false);
  const [applyingOptionOrder, setApplyingOptionOrder] = useState(false);
  const [draggingImageKey, setDraggingImageKey] = useState<string | null>(null);
  const [dragOverImageKey, setDragOverImageKey] = useState<string | null>(null);
  const [draggingOptionKey, setDraggingOptionKey] = useState<string | null>(null);
  const [dragOverOptionKey, setDragOverOptionKey] = useState<string | null>(null);
  const [selectedImageFiles, setSelectedImageFiles] = useState<Record<string, File | null>>({});
  const [selectedNewImageFile, setSelectedNewImageFile] = useState<File | null>(null);
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(null);

  const resetEditorPanels = (nextForm: ProductFormState) => {
    setExpandedImageKey(null);
    setExpandedOptionKey(null);
    setIsAddingImage(false);
    setIsAddingOption(false);
    setSelectedImageFiles({});
    setSelectedNewImageFile(null);
    setUploadingImageKey(null);
    setNewImage(createImageDraft(getNextSortOrder(nextForm.images)));
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
        setSavedImageOrderSignature(buildOrderSignature(nextForm.images));
        setSavedOptionOrderSignature(buildOrderSignature(nextForm.options));
        resetEditorPanels(nextForm);
      } else if (productId) {
        const [categoriesResult, productResult] = await Promise.all([categoriesPromise, apiClient.getAdminProductById(productId)]);
        const nextForm = formFromProduct(productResult);
        setCategories(categoriesResult.items);
        setProduct(productResult);
        setForm(nextForm);
        setInitialSignature(serializeFormState(nextForm));
        setSavedImageOrderSignature(buildOrderSignature(nextForm.images));
        setSavedOptionOrderSignature(buildOrderSignature(nextForm.options));
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
  const previewBasePrice = Number(form.basePrice);
  const previewDiscountRate = Number(form.discountRate || '0');
  const previewDiscountedPrice =
    Number.isFinite(previewBasePrice) && Number.isFinite(previewDiscountRate)
      ? calculateDiscountedPrice(previewBasePrice, previewDiscountRate)
      : 0;
  const hasDiscount = Number.isFinite(previewBasePrice) && previewDiscountRate > 0 && previewDiscountedPrice < previewBasePrice;
  const hasUnsavedChanges = useMemo(() => serializeFormState(form) !== initialSignature, [form, initialSignature]);
  const hasPendingImageOrderChanges = useMemo(
    () => buildOrderSignature(form.images) !== savedImageOrderSignature,
    [form.images, savedImageOrderSignature],
  );
  const hasPendingOptionOrderChanges = useMemo(
    () => buildOrderSignature(form.options) !== savedOptionOrderSignature,
    [form.options, savedOptionOrderSignature],
  );
  const configuredImageCount = useMemo(
    () => form.images.filter((image) => image.imageUrl.trim() !== '').length,
    [form.images],
  );
  const configuredOptionCount = useMemo(
    () => form.options.filter((option) => option.optionGroupName.trim() !== '' && option.optionValue.trim() !== '').length,
    [form.options],
  );
  const activeOptionCount = useMemo(() => form.options.filter((option) => option.isActive).length, [form.options]);
  const sortedImages = useMemo(() => sortImageDrafts(form.images), [form.images]);
  const imageGroups = useMemo(
    () => [{ type: 'THUMBNAIL' as const, label: '썸네일', items: sortedImages }],
    [sortedImages],
  );
  const optionGroupsForDisplay = useMemo(() => {
    const grouped = new Map<string, { label: string; items: ProductOptionDraft[] }>();

    for (const option of form.options) {
      const label = option.optionGroupName.trim() || '옵션 그룹 미입력';
      const existing = grouped.get(label);
      if (existing) {
        existing.items.push(option);
      } else {
        grouped.set(label, { label, items: [option] });
      }
    }

    return [...grouped.values()];
  }, [form.options]);

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
    setSelectedImageFiles((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setUploadingImageKey((current) => (current === key ? null : current));
    setExpandedImageKey((current) => (current === key ? null : current));
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

  const onImageDragStart = (event: DragEvent<HTMLElement>, key: string) => {
    setDraggingImageKey(key);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  };

  const onImageDragEnd = () => {
    setDraggingImageKey(null);
    setDragOverImageKey(null);
  };

  const onImageDragOver = (event: DragEvent<HTMLElement>, key: string) => {
    if (!draggingImageKey || draggingImageKey === key) {
      return;
    }

    const sourceImage = form.images.find((image) => image.key === draggingImageKey);
    const targetImage = form.images.find((image) => image.key === key);

    if (!sourceImage || !targetImage) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverImageKey(key);
  };

  const onImageDrop = (event: DragEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    const sourceKey = draggingImageKey ?? event.dataTransfer.getData('text/plain');

    if (!sourceKey || sourceKey === key) {
      return;
    }

    const sourceImage = form.images.find((image) => image.key === sourceKey);
    const targetImage = form.images.find((image) => image.key === key);

    if (!sourceImage || !targetImage) {
      setDraggingImageKey(null);
      setDragOverImageKey(null);
      return;
    }

    setForm((current) => ({
      ...current,
      images: reorderDraftItems(current.images, sourceKey, key),
    }));
    setDraggingImageKey(null);
    setDragOverImageKey(null);
  };

  const onOptionDragStart = (event: DragEvent<HTMLElement>, key: string) => {
    setDraggingOptionKey(key);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  };

  const onOptionDragEnd = () => {
    setDraggingOptionKey(null);
    setDragOverOptionKey(null);
  };

  const onOptionDragOver = (event: DragEvent<HTMLElement>, key: string) => {
    if (!draggingOptionKey || draggingOptionKey === key) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverOptionKey(key);
  };

  const onOptionDrop = (event: DragEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    const sourceKey = draggingOptionKey ?? event.dataTransfer.getData('text/plain');

    if (!sourceKey || sourceKey === key) {
      return;
    }

    setForm((current) => ({
      ...current,
      options: reorderDraftItems(current.options, sourceKey, key),
    }));
    setDraggingOptionKey(null);
    setDragOverOptionKey(null);
  };

  const toggleImageAddPanel = () => {
    setIsAddingImage((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setExpandedImageKey(null);
        setNewImage(createImageDraft(getNextSortOrder(form.images)));
        setSelectedNewImageFile(null);
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
    setSelectedNewImageFile(null);
    setNewImage(createImageDraft(getNextSortOrder([...form.images, newImage])));
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

  const buildUploadFolderSuffix = () => {
    const slugCandidate = (form.slug.trim() || product?.slug || '').toLowerCase();
    const normalizedSlug = slugCandidate
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    if (productId) {
      return normalizedSlug ? `product-${productId}-${normalizedSlug}` : `product-${productId}`;
    }

    return normalizedSlug || 'new-product';
  };

  const uploadProductImageToCloudinary = async (file: File) => {
    const signed = await apiClient.signAdminUpload({
      usage: 'PRODUCT_THUMBNAIL',
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

    return finalized.secureUrl;
  };

  const uploadProductContentImageToCloudinary = async (file: File) => {
    const signed = await apiClient.signAdminUpload({
      usage: 'PRODUCT_DETAIL',
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

    return {
      imageUrl: finalized.secureUrl,
      publicId: finalized.publicId,
      width: finalized.width,
      height: finalized.height,
    };
  };

  const deleteProductContentImageFromCloudinary = (publicId: string) => {
    if (!publicId.trim()) {
      return;
    }

    void apiClient.deleteAdminUpload({ publicId: publicId.trim() }).catch((caught) => {
      console.error('Failed to delete removed product content image', caught);
      showToast('본문 이미지 파일 삭제에 실패했습니다. 저장은 계속할 수 있습니다.', 'error');
    });
  };

  const onSelectExistingImageFile = (imageKey: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedImageFiles((current) => ({ ...current, [imageKey]: file }));
    event.target.value = '';
  };

  const onSelectNewImageFile = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedNewImageFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const onUploadExistingImage = async (image: ProductImageDraft) => {
    const file = selectedImageFiles[image.key];

    if (!file) {
      setError('업로드할 파일을 먼저 선택해주세요.');
      return;
    }

    setUploadingImageKey(image.key);
    setError('');

    try {
      const secureUrl = await uploadProductImageToCloudinary(file);
      replaceImage(image.key, { imageUrl: secureUrl });
      setSelectedImageFiles((current) => ({ ...current, [image.key]: null }));
      showToast('썸네일 이미지를 업로드했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingImageKey(null);
    }
  };

  const onUploadNewImage = async () => {
    if (!selectedNewImageFile) {
      setError('업로드할 파일을 먼저 선택해주세요.');
      return;
    }

    setUploadingImageKey('new-image');
    setError('');

    try {
      const secureUrl = await uploadProductImageToCloudinary(selectedNewImageFile);
      setNewImage((current) => ({ ...current, imageUrl: secureUrl }));
      setSelectedNewImageFile(null);
      showToast('썸네일 이미지 URL을 자동 입력했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingImageKey(null);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasUnsavedChanges || submitting || deleting) {
      return;
    }

    setSubmitSuccess(false);
    setSubmitting(true);
    setError('');

    try {
      const payload = buildPayload(form);

      if (isCreateMode) {
        const created = await apiClient.createAdminProduct(payload);
        showToast('상품을 생성했습니다.');
        setSubmitSuccess(true);
        await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));
        navigate(`/admin/products/${created.id}`, { replace: true });
        return;
      }

      if (!productId) {
        throw new Error('상품 식별자가 없습니다.');
      }

      await apiClient.updateAdminProduct(productId, payload);
      showToast('상품 정보를 저장했습니다.');
      setSubmitSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));
      await loadPage();
    } catch (caught) {
      setSubmitSuccess(false);
      setError(caught instanceof Error ? caught.message : '상품 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
      setSubmitSuccess(false);
    }
  };

  const onApplyImageOrder = async () => {
    if (isCreateMode || !productId || !hasPendingImageOrderChanges || applyingImageOrder) {
      return;
    }

    setApplyingImageOrder(true);
    setError('');

    try {
      await apiClient.updateAdminProduct(productId, {
        images: buildImageInputsFromDrafts(sortImageDrafts(form.images)),
      });
      setSavedImageOrderSignature(buildOrderSignature(form.images));
      showToast('이미지 순서를 적용했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '이미지 순서 적용에 실패했습니다.');
      showToast('이미지 순서 적용에 실패했습니다.', 'error');
    } finally {
      setApplyingImageOrder(false);
    }
  };

  const onApplyOptionOrder = async () => {
    if (isCreateMode || !productId || !hasPendingOptionOrderChanges || applyingOptionOrder) {
      return;
    }

    setApplyingOptionOrder(true);
    setError('');

    try {
      await apiClient.updateAdminProduct(productId, {
        optionGroups: buildOptionGroupInputsFromDrafts(form.options),
      });
      setSavedOptionOrderSignature(buildOrderSignature(form.options));
      showToast('옵션 순서를 적용했습니다.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '옵션 순서 적용에 실패했습니다.');
      showToast('옵션 순서 적용에 실패했습니다.', 'error');
    } finally {
      setApplyingOptionOrder(false);
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
        <LoadingScreen title="상품 정보를 준비하는 중" message="카테고리와 상품 상세 데이터를 불러오고 있습니다." />
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
        <section className="admin-editor-overview-bar" aria-label="편집 요약">
          <div className="admin-overview-chip">
            <span>이미지</span>
            <strong>{form.images.length}</strong>
          </div>
          <div className="admin-overview-chip">
            <span>옵션</span>
            <strong>{form.options.length}</strong>
          </div>
          <div className="admin-overview-chip">
            <span>변경 상태</span>
            <strong>{hasUnsavedChanges ? '변경됨' : '저장됨'}</strong>
          </div>
        </section>
      </section>

      <div className="admin-two-column admin-product-editor-grid">
        <form className="surface-card admin-card-stack admin-editor-card" onSubmit={onSubmit}>
          <AdminFloatingSubmitButton
            busy={submitting}
            busyLabel="저장 중..."
            disabled={submitting || deleting || !hasUnsavedChanges}
            label={isCreateMode ? '상품 생성' : '상품 저장'}
            success={submitSuccess}
          />
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Editor</p>
              <h3 className="section-subtitle">기본 정보</h3>
            </div>
            <div className="inline-actions">
              {/* <Link className="button button-secondary" to="/admin/products">
                목록
              </Link> */}
              {!isCreateMode ? (
                <Link className="button button-ghost" to={`/products/${productId ?? ''}`}>
                  스토어에서 보기
                </Link>
              ) : null}
            </div>
          </div>



          <div className="admin-check-grid">
            <label className="admin-check-field">
              <input
                type="checkbox"
                checked={form.isVisible}
                onChange={(event) => setForm((current) => ({ ...current, isVisible: event.target.checked }))}
              />
              <span>스토어 노출 여부</span>
            </label>
            <label className="admin-check-field">
              <input
                type="checkbox"
                checked={form.isSoldOut}
                onChange={(event) => setForm((current) => ({ ...current, isSoldOut: event.target.checked }))}
              />
              <span>품절 처리 여부</span>
            </label>
            <label className="admin-check-field">
              <input
                type="checkbox"
                checked={form.consultationRequired}
                onChange={(event) => setForm((current) => ({ ...current, consultationRequired: event.target.checked }))}
              />
              <span>상담 필요 여부</span>
            </label>
          </div>

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

              <label className="field admin-field-span-2">
                <span>영문명</span>
                <input
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="moru-tulip-bouquet"
                />
              </label>

              <hr className="admin-field-divider" />

              <label className="field">
                <span>기본 가격</span>
                <input
                  type="number"
                  min="0"
                  value={form.basePrice}
                  onChange={(event) => setForm((current) => ({ ...current, basePrice: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>할인율 (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.discountRate}
                  onChange={(event) => setForm((current) => ({ ...current, discountRate: event.target.value }))}
                  placeholder="0"
                />
              </label>

              <section className="admin-price-preview-grid" aria-label="할인 미리보기">
                <div className="admin-price-preview-card">
                  <span>설정된 할인 적용가</span>
                  <strong>{Number.isFinite(previewBasePrice) ? formatCurrency(previewDiscountedPrice) : '-'}</strong>
                  <small>{form.basePrice ? `기본가 ${formatCurrency(Number(form.basePrice))}` : '기본가 미입력'}</small>
                </div>

                <div className="admin-price-preview-card">
                  <span>할인 정보</span>
                  <strong>{hasDiscount ? `${formatDiscountRate(previewDiscountRate)} 할인` : '할인 없음'}</strong>
                  <small>{hasDiscount ? '현재 입력값 기준' : '할인율 0% 상태'}</small>
                </div>

                <div className="admin-price-preview-card">
                  <span>정가</span>
                  <strong>{form.basePrice ? formatCurrency(Number(form.basePrice)) : '-'}</strong>
                  <small>원가 기준 금액</small>
                </div>

                <div className="admin-price-preview-card">
                  <span>원가 대비</span>
                  <strong>{hasDiscount ? `-${formatCurrency(Math.max(0, previewBasePrice - previewDiscountedPrice))}` : '-'}</strong>
                  <small>{hasDiscount ? '할인 금액' : '할인 없음'}</small>
                </div>
              </section>

              <hr className="admin-field-divider" />

              <label className="field admin-field-span-2">
                <span>짧은 소개</span>
                <input
                  value={form.shortDescription}
                  onChange={(event) => setForm((current) => ({ ...current, shortDescription: event.target.value }))}
                  placeholder="목록 카드에 노출할 설명"
                />
              </label>

            </div>
          </section>
          <br />

          <section className="admin-form-section">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Thumbnail Images</p>
                <h3 className="section-subtitle">썸네일 이미지</h3>
                <span style={{ fontSize: "12px" }}>※ 드래그로 출력 순서 변경</span>
              </div>
              <div className="inline-actions">
                {!isCreateMode ? (
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => void onApplyImageOrder()}
                    disabled={!hasPendingImageOrderChanges || applyingImageOrder || submitting}
                  >
                    {applyingImageOrder ? '적용 중...' : '순서 적용'}
                  </button>
                ) : null}
                <button className="button button-secondary" type="button" onClick={toggleImageAddPanel}>
                  {isAddingImage ? '추가 닫기' : '+'}
                </button>
              </div>
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

                <div className="admin-image-upload-row" aria-live="polite">
                  <label className="button button-ghost" htmlFor="admin-new-image-file">
                    파일 선택
                  </label>
                  <input id="admin-new-image-file" className="sr-only" type="file" accept="image/*" onChange={onSelectNewImageFile} />
                  <span className="admin-inline-note">
                    {selectedNewImageFile
                      ? `${selectedNewImageFile.name} · ${formatFileSize(selectedNewImageFile.size)}`
                      : 'Cloudinary로 업로드하면 URL이 자동 입력됩니다.'}
                  </span>
                  <button
                    className="button"
                    type="button"
                    onClick={() => void onUploadNewImage()}
                    disabled={!selectedNewImageFile || uploadingImageKey !== null}
                  >
                    {uploadingImageKey === 'new-image' ? '업로드 중...' : 'Cloudinary 업로드'}
                  </button>
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
                <h4 className="section-subtitle" style={{fontSize : "15px"}}>등록된 이미지가 없습니다</h4>
              </section>
            ) : (
              <div className="admin-repeatable-grid">
                {imageGroups.map((group) => (
                  <div className="admin-image-type-group" key={group.type}>
                    <div className="admin-image-type-group-head">
                      <span className="section-kicker">{group.label}</span>
                      <strong>{group.items.length}개</strong>
                    </div>
                    {group.items.length === 0 ? <p className="admin-inline-note">등록된 {group.label} 이미지가 없습니다.</p> : null}
                    {group.items.map((image, index) => {
                      const isExpanded = expandedImageKey === image.key;
                      const selectedFile = selectedImageFiles[image.key] ?? null;
                      const isUploading = uploadingImageKey === image.key;

                      return (
                        <article
                          className={`admin-list-card admin-editor-list-card ${isExpanded ? 'is-active' : ''} ${draggingImageKey === image.key ? 'is-dragging' : ''
                            } ${dragOverImageKey === image.key ? 'is-drag-over' : ''}`}
                          key={image.key}
                          draggable
                          onDragStart={(event) => onImageDragStart(event, image.key)}
                          onDragEnd={onImageDragEnd}
                          onDragOver={(event) => onImageDragOver(event, image.key)}
                          onDrop={(event) => onImageDrop(event, image.key)}
                        >
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
                                      {index + 1}. {group.label} 이미지
                                    </strong>
                                  </div>
                                  {/* <span className={`status-pill ${image.imageUrl.trim() ? '' : 'is-muted'}`}>
                                    {image.imageUrl.trim() ? '준비됨' : '미완료'}
                                  </span> */}
                                </div>
                                {/* <div className="admin-meta-row">
                                  <span>정렬 {image.sortOrder || '-'}</span>
                                </div> */}
                              </div>
                            </button>

                            <div className="admin-item-actions">
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

                              <div className="admin-image-upload-row" aria-live="polite">
                                <label className="button button-ghost" htmlFor={`admin-image-file-${image.key}`}>
                                  파일 선택
                                </label>
                                <input
                                  id={`admin-image-file-${image.key}`}
                                  className="sr-only"
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => onSelectExistingImageFile(image.key, event)}
                                />
                                <span className="admin-inline-note">
                                  {selectedFile ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}` : '파일 선택 후 업로드하면 URL이 자동 입력됩니다.'}
                                </span>
                                <button
                                  className="button"
                                  type="button"
                                  onClick={() => void onUploadExistingImage(image)}
                                  disabled={!selectedFile || uploadingImageKey !== null}
                                >
                                  {isUploading ? '업로드 중...' : 'Cloudinary 업로드'}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
          <br />

          <section className="admin-form-section">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Options</p>
                <h3 className="section-subtitle">옵션</h3>
                <span style={{ fontSize: "12px" }}>※ 드래그로 출력 순서 변경</span>
              </div>
              <div className="inline-actions">
                {!isCreateMode ? (
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => void onApplyOptionOrder()}
                    disabled={!hasPendingOptionOrderChanges || applyingOptionOrder || submitting}
                  >
                    {applyingOptionOrder ? '적용 중...' : '순서 적용'}
                  </button>
                ) : null}
                <button className="button button-secondary" type="button" onClick={toggleOptionAddPanel}>
                  {isAddingOption ? '추가 닫기' : '+'}
                </button>
              </div>
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
                    <span>선택 방식</span>
                    <select
                      value={newOption.selectionType}
                      onChange={(event) =>
                        setNewOption((current) => ({
                          ...current,
                          selectionType: event.target.value as 'SINGLE' | 'QUANTITY',
                        }))
                      }
                    >
                      <option value="SINGLE">하나만 선택</option>
                      <option value="QUANTITY">수량 선택</option>
                    </select>
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
                    <span>최대 수량</span>
                    <input
                      type="number"
                      min={1}
                      value={newOption.maxQuantity}
                      onChange={(event) => setNewOption((current) => ({ ...current, maxQuantity: event.target.value }))}
                      placeholder={newOption.selectionType === 'QUANTITY' ? '선택 가능 최대 수량' : '비워두기'}
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
                      checked={newOption.isRequired}
                      onChange={(event) => setNewOption((current) => ({ ...current, isRequired: event.target.checked }))}
                    />
                    <span>필수 그룹</span>
                  </label>
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
                <h4 className="section-subtitle" style={{fontSize:"15px"}}>등록된 옵션이 없습니다</h4>
              </section>
            ) : (
              <div className="admin-option-group-list">
                {optionGroupsForDisplay.map((group) => (
                  <section className="admin-option-group" key={group.label}>
                    <div className="admin-option-group-divider" aria-hidden="true">
                      <hr />
                      <span>{group.label}</span>
                      <hr />
                    </div>
                    <div className="admin-repeatable-grid">
                      {group.items.map((option) => {
                        const optionIndex = form.options.findIndex((candidate) => candidate.key === option.key);
                        const isExpanded = expandedOptionKey === option.key;
                        const extraPrice = Number(option.extraPrice || '0');
                        const extraPriceLabel = Number.isFinite(extraPrice)
                          ? extraPrice === 0
                            ? '추가 금액 x'
                            : `${extraPrice > 0 ? '+' : ''}${formatCurrency(extraPrice)}`
                          : '금액 확인 필요';

                        return (
                          <article
                            className={`admin-list-card admin-editor-list-card ${isExpanded ? 'is-active' : ''} ${draggingOptionKey === option.key ? 'is-dragging' : ''
                              } ${dragOverOptionKey === option.key ? 'is-drag-over' : ''}`}
                            key={option.key}
                            draggable
                            onDragStart={(event) => onOptionDragStart(event, option.key)}
                            onDragEnd={onOptionDragEnd}
                            onDragOver={(event) => onOptionDragOver(event, option.key)}
                            onDrop={(event) => onOptionDrop(event, option.key)}
                          >
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
                                        {optionIndex + 1}. {option.optionGroupName.trim() || '옵션 그룹 미입력'} |{' '}
                                        {option.optionValue.trim() || '옵션 값 미입력'}
                                      </strong>
                                    </div>
                                  </div>
                                  <div className="admin-product-summary" style={{ marginTop: '5px' }}>
                                    <span
                                      className={`status-pill ${option.isActive ? '' : 'is-muted'}`}
                                      style={{ marginRight: '10px' }}
                                    >
                                      {option.isActive ? '활성' : '비활성'}
                                    </span>
                                    <span style={{ marginTop: '6px', marginRight: '10px' }}>
                                      {option.selectionType === 'SINGLE' ? '단일 선택' : '수량 선택'}
                                    </span>
                                    <span style={{ marginTop: '6px' }}>{extraPriceLabel}</span>
                                  </div>
                                </div>
                              </button>

                              <div className="admin-item-actions">
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
                                    <span>선택 방식</span>
                                    <select
                                      value={option.selectionType}
                                      onChange={(event) =>
                                        replaceOption(option.key, {
                                          selectionType: event.target.value as 'SINGLE' | 'QUANTITY',
                                        })
                                      }
                                    >
                                      <option value="SINGLE">하나만 선택</option>
                                      <option value="QUANTITY">수량 선택</option>
                                    </select>
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
                                    <span>최대 수량</span>
                                    <input
                                      type="number"
                                      min={1}
                                      value={option.maxQuantity}
                                      onChange={(event) => replaceOption(option.key, { maxQuantity: event.target.value })}
                                      placeholder={option.selectionType === 'QUANTITY' ? '선택 가능 최대 수량' : '비워두기'}
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
                                      checked={option.isRequired}
                                      onChange={(event) => replaceOption(option.key, { isRequired: event.target.checked })}
                                    />
                                    <span>필수 그룹</span>
                                  </label>
                                  <label className="admin-check-field admin-check-field-inline">
                                    <input
                                      type="checkbox"
                                      checked={option.isActive}
                                      onChange={(event) => replaceOption(option.key, { isActive: event.target.checked })}
                                    />
                                    <span>옵션 활성화</span>
                                  </label>
                                </div>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
          <br />

          <section className="admin-form-section">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Content Editor</p>
                <h3 className="section-subtitle">상품 상세 정보</h3>
              </div>
            </div>

            <div className="admin-field-grid">
              <section className="field admin-field-span-2">
                <span>상세 본문 캔버스</span>
                <ProductContentEditor
                  blocks={form.contentBlocks}
                  formatFileSize={formatFileSize}
                  onChange={(contentBlocks) => setForm((current) => ({ ...current, contentBlocks }))}
                  onDeleteImage={deleteProductContentImageFromCloudinary}
                  onUploadImage={(file) => uploadProductContentImageToCloudinary(file)}
                />
              </section>
            </div>
          </section>

          {error ? (
            <p className="feedback-copy is-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="inline-actions">
            <button className="button" type="submit" disabled={submitting || deleting || !hasUnsavedChanges}>
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
              <h3 className="section-subtitle">상품 요약</h3>
            </div>
            {!isCreateMode && product ? <span className="status-pill">ID {product.id}</span> : null}
          </div>

          <div className="admin-pill-row">
            <span className={`status-pill ${form.isVisible ? '' : 'is-muted'}`}>{form.isVisible ? '노출' : '숨김'}</span>
            <span className={`status-pill ${form.isSoldOut ? 'is-muted' : ''}`}>{form.isSoldOut ? '품절' : '판매중'}</span>
            <span className={`status-pill ${form.consultationRequired ? '' : 'is-muted'}`}>{form.consultationRequired ? '상담 필요' : '일반 주문'}</span>
            {product?.deletedAt ? <span className="status-pill is-muted">삭제됨</span> : null}
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
              <span>할인율</span>
              <strong>{form.discountRate ? formatDiscountRate(Number(form.discountRate)) : '0%'}</strong>
            </div>
            <div className="admin-summary-item">
              <span>할인가</span>
              <strong>{form.basePrice ? formatCurrency(previewDiscountedPrice) : '-'}</strong>
            </div>
            {/* <div className="admin-summary-item">
              <span>변경 상태</span>
              <strong>{hasUnsavedChanges ? '저장 필요' : '최신 상태'}</strong>
            </div> */}
          </div>


          {product ? (
            <>
              <div className="admin-summary-grid">
                <div className="admin-summary-item">
                  <span>최초 생성</span>
                  <strong>{formatAdminDateTime(product.createdAt)}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>마지막 수정</span>
                  <strong>{formatAdminDateTime(product.updatedAt)}</strong>
                </div>
              </div>

              <section className="admin-subcard">
                <p className="section-kicker">운영 지표</p>
                <div className="admin-summary-grid">
                  <div className="admin-summary-item">
                    <span>카테고리 영문명</span>
                    <strong>{product.category.slug}</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>주문된 횟수</span>
                    <strong>{product.orderItemCount}건</strong>
                  </div>
                  <div className="admin-summary-item">
                    <span>카테고리 노출 여부</span>
                    <strong>{product.category.isVisible ? '노출' : '숨김'}</strong>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <p className="feedback-copy">생성 후에는 정책 정보와 실제 반영 결과를 이 영역에서 함께 확인할 수 있습니다.</p>
          )}

          <section className="admin-subcard">
            <p className="section-kicker">저장 전 미리보기</p>
            <div className="admin-summary-grid">
              <div className="admin-summary-item">
                <span>이미지</span>
                <strong>{configuredImageCount}개 </strong>
              </div>
              <div className="admin-summary-item">
                <span>옵션</span>
                <strong>{configuredOptionCount}개</strong>
              </div>
              <div className="admin-summary-item">
                <span>활성화 된 옵션</span>
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
