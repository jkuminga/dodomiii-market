const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000/api/v1';

type ApiAuthErrorPayload = {
  status: number;
  message: string;
  code?: string;
};

type ApiAuthErrorHandler = (payload: ApiAuthErrorPayload) => void;

let apiAuthErrorHandler: ApiAuthErrorHandler | null = null;

export function setApiAuthErrorHandler(handler: ApiAuthErrorHandler | null) {
  apiAuthErrorHandler = handler;
}

type ApiErrorShape = {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

type ApiEnvelope<T, M = undefined> = ApiErrorShape & {
  data?: T;
  meta?: M;
};

async function requestEnvelope<T, M = undefined>(path: string, init?: RequestInit): Promise<ApiEnvelope<T, M>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T, M>;

  if (!response.ok || body.success === false) {
    const message = body.error?.message ?? '요청 처리 중 오류가 발생했습니다.';
    const code = body.error?.code;

    if (response.status === 401 || code === 'UNAUTHORIZED' || code === 'SESSION_EXPIRED') {
      apiAuthErrorHandler?.({
        status: response.status || 401,
        message,
        code,
      });
    }

    throw new Error(message);
  }

  return body;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await requestEnvelope<T>(path, init);

  if (body.data === undefined) {
    throw new Error('응답 데이터가 비어 있습니다.');
  }

  return body.data;
}

async function requestWithMeta<T, M>(path: string, init?: RequestInit): Promise<{ data: T; meta: M }> {
  const body = await requestEnvelope<T, M>(path, init);

  if (body.data === undefined) {
    throw new Error('응답 데이터가 비어 있습니다.');
  }

  if (body.meta === undefined) {
    throw new Error('응답 메타 데이터가 비어 있습니다.');
  }

  return {
    data: body.data,
    meta: body.meta,
  };
}

function buildQueryString(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export type AdminRole = 'SUPER' | 'STAFF';

export type AdminSession = {
  adminId: number | string;
  loginId: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
};

export type AdminAccount = {
  adminId: number;
  loginId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: AdminRole;
  isActive: boolean;
  depositBankName: string | null;
  depositAccountHolder: string | null;
  depositAccountNumber: string | null;
  isPrimaryDepositAccount: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminAccountCreatePayload = {
  loginId: string;
  password: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: AdminRole;
  isActive?: boolean;
  depositBankName?: string | null;
  depositAccountHolder?: string | null;
  depositAccountNumber?: string | null;
  isPrimaryDepositAccount?: boolean;
};

export type AdminAccountUpdatePayload = Partial<AdminAccountCreatePayload>;

export type CategoryTreeNode = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  isOnLandingPage: boolean;
  sortOrder: number;
  children: CategoryTreeNode[];
};

export type AdminCategoryItem = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  isOnLandingPage: boolean;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCategoryPayload = {
  parentId: number | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  isOnLandingPage: boolean;
  sortOrder: number;
  isVisible: boolean;
};

export type ProductListItem = {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  basePrice: number;
  isSoldOut: boolean;
  consultationRequired: boolean;
  thumbnailImageUrl: string | null;
};

export type ProductDetail = {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  basePrice: number;
  isSoldOut: boolean;
  consultationRequired: boolean;
  stockQuantity: number | null;
  images: Array<{
    id: number;
    imageType: 'THUMBNAIL' | 'DETAIL';
    imageUrl: string;
    sortOrder: number;
  }>;
  optionGroups: Array<{
    id: number;
    name: string;
    selectionType: 'SINGLE' | 'QUANTITY';
    isRequired: boolean;
    isActive: boolean;
    sortOrder: number;
    options: Array<{
      id: number;
      name: string;
      extraPrice: number;
      maxQuantity: number | null;
      isActive: boolean;
      sortOrder: number;
    }>;
  }>;
  policy: {
    shippingInfo: string;
    refundInfo: string;
  };
};

export type AdminProductListItem = {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  basePrice: number;
  isVisible: boolean;
  isSoldOut: boolean;
  consultationRequired: boolean;
  stockQuantity: number | null;
  thumbnailImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminProductImageInput = {
  imageType: 'THUMBNAIL' | 'DETAIL';
  imageUrl: string;
  sortOrder: number;
};

export type AdminProductOptionInput = {
  name: string;
  extraPrice: number;
  maxQuantity?: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type AdminProductOptionGroupInput = {
  name: string;
  selectionType: 'SINGLE' | 'QUANTITY';
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  options: AdminProductOptionInput[];
};

export type AdminProductPayload = {
  categoryId: number;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  basePrice: number;
  isVisible: boolean;
  isSoldOut: boolean;
  consultationRequired: boolean;
  stockQuantity: number | null;
  images: AdminProductImageInput[];
  optionGroups: AdminProductOptionGroupInput[];
};

export type AdminHomePopup = {
  id: number;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminHomeHero = {
  key: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminHomePopupPayload = {
  popupId?: number;
  title?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  isActive?: boolean;
};

export type NoticeContentBlock =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      imageUrl: string;
      publicId?: string | null;
      alt?: string | null;
      caption?: string | null;
    };

export type NoticeContent = {
  version: number;
  blocks: NoticeContentBlock[];
};

export type AdminNoticeListItem = {
  id: number;
  title: string;
  summary: string | null;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  thumbnailImageUrl: string | null;
  blockCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminNoticeDetail = {
  id: number;
  title: string;
  summary: string | null;
  contentJson: NoticeContent;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  thumbnailImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AdminNoticePayload = {
  title: string;
  summary?: string | null;
  contentJson: NoticeContent;
  isPinned?: boolean;
  isPublished?: boolean;
  publishedAt?: string | null;
};

export type AdminNoticeListQuery = {
  q?: string;
  isPublished?: boolean;
  page?: number;
  size?: number;
};

export type StoreNoticeListItem = {
  id: number;
  title: string;
  summary: string | null;
  isPinned: boolean;
  thumbnailImageUrl: string | null;
  publishedAt: string;
};

export type StoreNoticeDetail = {
  id: number;
  title: string;
  summary: string | null;
  contentJson: NoticeContent;
  isPinned: boolean;
  thumbnailImageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
};

export type AdminMediaUsage = 'HOME_POPUP' | 'HOME_HERO' | 'PRODUCT_THUMBNAIL' | 'PRODUCT_DETAIL' | 'NOTICE_CONTENT';

export type AdminMediaSignUploadPayload = {
  usage: AdminMediaUsage;
  fileName?: string;
  contentType?: string;
  folderSuffix?: string;
  size?: number;
};

export type AdminMediaSignedUpload = {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
  maxBytes: number;
};

export type AdminMediaFinalizePayload = {
  publicId: string;
  version: number;
  secureUrl: string;
  signature?: string;
  resourceType?: 'image';
  format?: string;
  width?: number;
  height?: number;
  bytes?: number;
};

export type AdminMediaAsset = {
  publicId: string;
  version: number;
  secureUrl: string;
  optimizedUrl: string;
  resourceType: 'image';
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
};

export type AdminMediaDeletePayload = {
  publicId: string;
};

export type AdminMediaDeleteResult = {
  publicId: string;
  deleted: boolean;
  result: string;
};

export type StoreHomePopup = {
  id: number;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreHomeHero = {
  imageUrl: string;
  updatedAt: string;
};

export type AdminProductDetail = {
  id: number;
  category: {
    id: number;
    name: string;
    slug: string;
    parentId: number | null;
    isVisible: boolean;
  };
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  basePrice: number;
  isVisible: boolean;
  isSoldOut: boolean;
  consultationRequired: boolean;
  stockQuantity: number | null;
  images: Array<{
    id: number;
    imageType: 'THUMBNAIL' | 'DETAIL';
    imageUrl: string;
    sortOrder: number;
    createdAt: string;
  }>;
  optionGroups: Array<{
    id: number;
    name: string;
    selectionType: 'SINGLE' | 'QUANTITY';
    isRequired: boolean;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    options: Array<{
      id: number;
      name: string;
      extraPrice: number;
      maxQuantity: number | null;
      isActive: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  orderItemCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type PaginationMeta = {
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type AdminProductListQuery = {
  categoryId?: number;
  q?: string;
  isVisible?: boolean;
  isSoldOut?: boolean;
  page?: number;
  size?: number;
};

export type StoreOrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAYMENT_REQUESTED'
  | 'PAYMENT_CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'EXPIRED';

export type StoreDepositStatus = 'WAITING' | 'REQUESTED' | 'CONFIRMED' | 'REJECTED';
export type StoreShipmentStatus = 'READY' | 'SHIPPED' | 'DELIVERED';

export type StoreOrderCreateRequest = {
  items: Array<{
    productId: number;
    selectedOptions?: Array<{
      productOptionGroupId: number;
      productOptionId: number;
      quantity: number;
    }>;
    quantity: number;
  }>;
  contact: {
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    zipcode: string;
    address1: string;
    address2?: string;
    userSelectedType?: 'R' | 'J';
    roadAddress?: string;
    jibunAddress?: string;
  };
  customerRequest?: string;
};

export type StoreOrderCreateResponse = {
  orderId: number;
  orderNumber: string;
  orderStatus: StoreOrderStatus;
  items?: Array<{
    productId: number;
    productOptionId: number | null;
    productNameSnapshot: string;
    optionNameSnapshot: string | null;
    optionValueSnapshot: string | null;
    unitPrice: number;
    quantity: number;
    lineTotalPrice: number;
    selectedOptions: Array<{
      productOptionGroupId: number;
      productOptionId: number;
      groupNameSnapshot: string;
      optionNameSnapshot: string;
      extraPriceSnapshot: number;
      quantity: number;
    }>;
  }>;
  pricing: {
    totalProductPrice: number;
    shippingFee: number;
    finalTotalPrice: number;
  };
  depositInfo: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    expectedAmount: number;
    depositStatus: StoreDepositStatus;
    depositDeadlineAt: string | null;
  };
  createdAt?: string;
};

export type StoreOrderLookupResponse = {
  orderNumber: string;
  orderStatus: StoreOrderStatus;
  items: Array<{
    productNameSnapshot: string;
    thumbnailImageUrl?: string | null;
    optionNameSnapshot: string | null;
    optionValueSnapshot: string | null;
    unitPrice: number;
    quantity: number;
    lineTotalPrice: number;
  }>;
  contact: {
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    zipcode: string;
    address1: string;
    address2: string | null;
  };
  pricing: {
    totalProductPrice: number;
    shippingFee: number;
    finalTotalPrice: number;
  };
  deposit: {
    depositStatus: StoreDepositStatus;
    bankName?: string | null;
    accountHolder?: string | null;
    accountNumber?: string | null;
    expectedAmount?: number | null;
    depositorName?: string | null;
    requestedAt: string | null;
    confirmedAt: string | null;
    depositDeadlineAt?: string | null;
    adminMemo?: string | null;
  };
  shipment: {
    shipmentStatus: StoreShipmentStatus;
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl?: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  };
  statusHistories?: Array<{
    orderStatusHistoryId: number;
    previousStatus: StoreOrderStatus | null;
    newStatus: StoreOrderStatus;
    changeReason: string | null;
    changedByAdminId: number | null;
    createdAt: string;
  }>;
  createdAt?: string;
  updatedAt: string;
};

export type StoreDepositRequestPayload = {
  depositorName?: string;
  memo?: string;
};

export type StoreDepositRequestResponse = {
  orderNumber: string;
  orderStatus: StoreOrderStatus;
  depositStatus: StoreDepositStatus;
  requestedAt: string | null;
  confirmedAt?: string | null;
  requestAccepted?: boolean;
};

export type StoreOrderTrackingResponse = {
  orderNumber: string;
  shipmentStatus: StoreShipmentStatus;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};

export type AdminCustomOrderLinkCreatePayload = {
  finalTotalPrice: number;
  shippingFee: number;
  note?: string;
  expiresAt: string;
};

export type AdminCustomOrderLinkSummary = {
  linkId: number;
  token: string;
  checkoutUrl: string;
  finalTotalPrice: number;
  shippingFee: number;
  note: string | null;
  isUsed: boolean;
  usedOrderId: number | null;
  expiresAt: string;
  createdAt: string;
};

export type AdminCustomOrderLinkDetail = AdminCustomOrderLinkSummary & {
  usedAt?: string | null;
};

export type StoreCustomCheckoutLink = {
  token: string;
  productName: string;
  finalTotalPrice: number;
  expiresAt: string;
  isExpired: boolean;
};

export type StoreCustomCheckoutOrderCreateRequest = {
  contact: {
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    zipcode: string;
    address1: string;
    address2?: string;
    userSelectedType?: 'R' | 'J';
    roadAddress?: string;
    jibunAddress?: string;
  };
  customerRequest?: string;
};

export type AdminOrderListQuery = {
  q?: string;
  orderStatus?: StoreOrderStatus;
  page?: number;
  size?: number;
};

export type AdminOrderListItem = {
  id: number;
  orderNumber: string;
  orderStatus: StoreOrderStatus;
  depositStatus: StoreDepositStatus;
  shipmentStatus: StoreShipmentStatus;
  buyerName: string;
  buyerPhone: string;
  receiverName: string;
  receiverPhone: string;
  finalTotalPrice: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderDetail = {
  id: number;
  orderNumber: string;
  orderStatus: StoreOrderStatus;
  customerRequest: string | null;
  items: Array<{
    productId?: number | null;
    productOptionId?: number | null;
    productNameSnapshot: string;
    optionNameSnapshot: string | null;
    optionValueSnapshot: string | null;
    unitPrice: number;
    quantity: number;
    lineTotalPrice: number;
  }>;
  contact: {
    buyerName: string;
    buyerPhone: string;
    receiverName: string;
    receiverPhone: string;
    zipcode: string;
    address1: string;
    address2: string | null;
  };
  pricing: {
    totalProductPrice: number;
    shippingFee: number;
    finalTotalPrice: number;
  };
  deposit: {
    depositStatus: StoreDepositStatus;
    bankName: string | null;
    accountHolder: string | null;
    accountNumber: string | null;
    expectedAmount: number | null;
    depositorName: string | null;
    requestedAt: string | null;
    confirmedAt: string | null;
    depositDeadlineAt: string | null;
    adminMemo: string | null;
  };
  shipment: {
    shipmentStatus: StoreShipmentStatus;
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  };
  statusHistories: Array<{
    orderStatusHistoryId: number;
    previousStatus: StoreOrderStatus | null;
    newStatus: StoreOrderStatus;
    changeReason: string | null;
    changedByAdminId: number | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderStatusUpdatePayload = {
  orderStatus: StoreOrderStatus;
  changeReason?: string;
};

export type AdminOrderShipmentUpdatePayload = {
  courierName?: string | null;
  trackingNumber?: string | null;
  shipmentStatus: StoreShipmentStatus;
};

const STORE_ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAYMENT_REQUESTED',
  'PAYMENT_CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'EXPIRED',
] as const satisfies readonly StoreOrderStatus[];

const STORE_DEPOSIT_STATUSES = ['WAITING', 'REQUESTED', 'CONFIRMED', 'REJECTED'] as const satisfies readonly StoreDepositStatus[];
const STORE_SHIPMENT_STATUSES = ['READY', 'SHIPPED', 'DELIVERED'] as const satisfies readonly StoreShipmentStatus[];

type AdminOrderDetailResponse = {
  id?: number | string;
  orderId?: number | string;
  orderNumber?: string | null;
  orderStatus?: StoreOrderStatus;
  customerRequest?: string | null;
  items?: Array<{
    productId?: number | string | null;
    productOptionId?: number | string | null;
    productNameSnapshot?: string | null;
    optionNameSnapshot?: string | null;
    optionValueSnapshot?: string | null;
    unitPrice?: number | null;
    quantity?: number | null;
    lineTotalPrice?: number | null;
  }> | null;
  contact?: {
    buyerName?: string | null;
    buyerPhone?: string | null;
    receiverName?: string | null;
    receiverPhone?: string | null;
    zipcode?: string | null;
    address1?: string | null;
    address2?: string | null;
  } | null;
  pricing?: {
    totalProductPrice?: number | null;
    shippingFee?: number | null;
    finalTotalPrice?: number | null;
  } | null;
  deposit?: {
    depositStatus?: StoreDepositStatus;
    bankName?: string | null;
    accountHolder?: string | null;
    accountNumber?: string | null;
    expectedAmount?: number | null;
    depositorName?: string | null;
    requestedAt?: string | null;
    confirmedAt?: string | null;
    depositDeadlineAt?: string | null;
    adminMemo?: string | null;
  } | null;
  shipment?: {
    shipmentStatus?: StoreShipmentStatus;
    courierName?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    shippedAt?: string | null;
    deliveredAt?: string | null;
  } | null;
  statusHistories?: Array<{
    orderStatusHistoryId?: number | string;
    id?: number | string;
    previousStatus?: StoreOrderStatus | null;
    newStatus?: StoreOrderStatus;
    changeReason?: string | null;
    changedByAdminId?: number | string | null;
    adminId?: number | string | null;
    createdAt?: string | null;
  }> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type AdminCustomOrderLinkResponse = {
  linkId?: number | string;
  id?: number | string;
  token?: string | null;
  checkoutUrl?: string | null;
  finalTotalPrice?: number | string | null;
  shippingFee?: number | string | null;
  note?: string | null;
  isUsed?: boolean | null;
  usedAt?: string | null;
  usedOrderId?: number | string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
};

type AdminCustomOrderLinkListResponse = {
  items?: AdminCustomOrderLinkResponse[] | null;
};

type StoreCustomCheckoutLinkResponse = {
  token?: string | null;
  productName?: string | null;
  finalTotalPrice?: number | string | null;
  expiresAt?: string | null;
  isExpired?: boolean | null;
};

function normalizeNumber(value: number | string | null | undefined, fallback = 0): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeOrderStatus(value: unknown): StoreOrderStatus {
  return typeof value === 'string' && STORE_ORDER_STATUSES.includes(value as StoreOrderStatus)
    ? (value as StoreOrderStatus)
    : 'PENDING_PAYMENT';
}

function normalizeDepositStatus(value: unknown): StoreDepositStatus {
  return typeof value === 'string' && STORE_DEPOSIT_STATUSES.includes(value as StoreDepositStatus)
    ? (value as StoreDepositStatus)
    : 'WAITING';
}

function normalizeShipmentStatus(value: unknown): StoreShipmentStatus {
  return typeof value === 'string' && STORE_SHIPMENT_STATUSES.includes(value as StoreShipmentStatus)
    ? (value as StoreShipmentStatus)
    : 'READY';
}

function normalizeAdminOrderListItem(raw: {
  id?: number | string;
  orderId?: number | string;
  orderNumber: string;
  orderStatus: StoreOrderStatus;
  depositStatus?: StoreDepositStatus;
  shipmentStatus?: StoreShipmentStatus;
  buyerName?: string;
  buyerPhone?: string;
  receiverName?: string;
  receiverPhone?: string;
  finalTotalPrice?: number;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
  contact?: {
    buyerName?: string;
    buyerPhone?: string;
    receiverName?: string;
    receiverPhone?: string;
  };
  pricing?: {
    finalTotalPrice?: number;
  };
  deposit?: {
    depositStatus?: StoreDepositStatus;
  };
  shipment?: {
    shipmentStatus?: StoreShipmentStatus;
  };
  items?: unknown[];
}): AdminOrderListItem {
  const id = raw.id ?? raw.orderId;

  if (id === undefined) {
    throw new Error('주문 식별자가 응답에 없습니다.');
  }

  return {
    id: Number(id),
    orderNumber: raw.orderNumber,
    orderStatus: normalizeOrderStatus(raw.orderStatus),
    depositStatus: normalizeDepositStatus(raw.depositStatus ?? raw.deposit?.depositStatus),
    shipmentStatus: normalizeShipmentStatus(raw.shipmentStatus ?? raw.shipment?.shipmentStatus),
    buyerName: raw.buyerName ?? raw.contact?.buyerName ?? '-',
    buyerPhone: raw.buyerPhone ?? raw.contact?.buyerPhone ?? '',
    receiverName: raw.receiverName ?? raw.contact?.receiverName ?? '-',
    receiverPhone: raw.receiverPhone ?? raw.contact?.receiverPhone ?? '',
    finalTotalPrice: raw.finalTotalPrice ?? raw.pricing?.finalTotalPrice ?? 0,
    itemCount: raw.itemCount ?? raw.items?.length ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeAdminOrderDetail(raw: AdminOrderDetailResponse): AdminOrderDetail {
  const identifier = raw.id ?? raw.orderId;

  if (identifier === undefined || identifier === null) {
    throw new Error('주문 식별자가 응답에 없습니다.');
  }

  const id = normalizeNumber(identifier, Number.NaN);

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('주문 식별자 형식이 올바르지 않습니다.');
  }

  return {
    id,
    orderNumber: raw.orderNumber?.trim() || `주문 #${id}`,
    orderStatus: normalizeOrderStatus(raw.orderStatus),
    customerRequest: raw.customerRequest ?? null,
    items: Array.isArray(raw.items)
      ? raw.items.map((item, index) => ({
          productId: item.productId === null || item.productId === undefined ? null : normalizeNumber(item.productId, 0),
          productOptionId:
            item.productOptionId === null || item.productOptionId === undefined
              ? null
              : normalizeNumber(item.productOptionId, 0),
          productNameSnapshot: item.productNameSnapshot?.trim() || `상품 ${index + 1}`,
          optionNameSnapshot: item.optionNameSnapshot ?? null,
          optionValueSnapshot: item.optionValueSnapshot ?? null,
          unitPrice: normalizeNumber(item.unitPrice, 0),
          quantity: normalizeNumber(item.quantity, 0),
          lineTotalPrice: normalizeNumber(item.lineTotalPrice, 0),
        }))
      : [],
    contact: {
      buyerName: raw.contact?.buyerName?.trim() || '-',
      buyerPhone: raw.contact?.buyerPhone ?? '',
      receiverName: raw.contact?.receiverName?.trim() || '-',
      receiverPhone: raw.contact?.receiverPhone ?? '',
      zipcode: raw.contact?.zipcode?.trim() || '',
      address1: raw.contact?.address1?.trim() || '',
      address2: raw.contact?.address2?.trim() || null,
    },
    pricing: {
      totalProductPrice: normalizeNumber(raw.pricing?.totalProductPrice, 0),
      shippingFee: normalizeNumber(raw.pricing?.shippingFee, 0),
      finalTotalPrice: normalizeNumber(raw.pricing?.finalTotalPrice, 0),
    },
    deposit: {
      depositStatus: normalizeDepositStatus(raw.deposit?.depositStatus),
      bankName: raw.deposit?.bankName ?? null,
      accountHolder: raw.deposit?.accountHolder ?? null,
      accountNumber: raw.deposit?.accountNumber ?? null,
      expectedAmount: raw.deposit?.expectedAmount ?? null,
      depositorName: raw.deposit?.depositorName ?? null,
      requestedAt: raw.deposit?.requestedAt ?? null,
      confirmedAt: raw.deposit?.confirmedAt ?? null,
      depositDeadlineAt: raw.deposit?.depositDeadlineAt ?? null,
      adminMemo: raw.deposit?.adminMemo ?? null,
    },
    shipment: {
      shipmentStatus: normalizeShipmentStatus(raw.shipment?.shipmentStatus),
      courierName: raw.shipment?.courierName ?? null,
      trackingNumber: raw.shipment?.trackingNumber ?? null,
      trackingUrl: raw.shipment?.trackingUrl ?? null,
      shippedAt: raw.shipment?.shippedAt ?? null,
      deliveredAt: raw.shipment?.deliveredAt ?? null,
    },
    statusHistories: Array.isArray(raw.statusHistories)
      ? raw.statusHistories.map((history) => ({
          orderStatusHistoryId: normalizeNumber(history.orderStatusHistoryId ?? history.id, 0),
          previousStatus: history.previousStatus ? normalizeOrderStatus(history.previousStatus) : null,
          newStatus: normalizeOrderStatus(history.newStatus ?? raw.orderStatus),
          changeReason: history.changeReason ?? null,
          changedByAdminId:
            history.changedByAdminId === null || history.changedByAdminId === undefined
              ? history.adminId === null || history.adminId === undefined
                ? null
                : normalizeNumber(history.adminId, 0)
              : normalizeNumber(history.changedByAdminId, 0),
          createdAt: history.createdAt ?? '',
        }))
      : [],
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

function normalizeAdminCustomOrderLinkSummary(raw: AdminCustomOrderLinkResponse): AdminCustomOrderLinkSummary {
  const identifier = raw.linkId ?? raw.id;

  if (identifier === undefined || identifier === null) {
    throw new Error('커스텀 주문 링크 식별자가 응답에 없습니다.');
  }

  const linkId = normalizeNumber(identifier, Number.NaN);

  if (!Number.isFinite(linkId) || linkId <= 0) {
    throw new Error('커스텀 주문 링크 식별자 형식이 올바르지 않습니다.');
  }

  const token = raw.token?.trim();
  const checkoutUrl = raw.checkoutUrl?.trim();
  const normalizedUsedOrderId =
    raw.usedOrderId === null || raw.usedOrderId === undefined ? null : normalizeNumber(raw.usedOrderId, Number.NaN);

  if (!token) {
    throw new Error('커스텀 주문 링크 토큰이 응답에 없습니다.');
  }

  if (!checkoutUrl) {
    throw new Error('커스텀 주문 체크아웃 URL이 응답에 없습니다.');
  }

  return {
    linkId,
    token,
    checkoutUrl,
    finalTotalPrice: normalizeNumber(raw.finalTotalPrice, 0),
    shippingFee: normalizeNumber(raw.shippingFee, 0),
    note: raw.note ?? null,
    isUsed: normalizeBoolean(raw.isUsed, false),
    usedOrderId:
      normalizedUsedOrderId !== null && Number.isFinite(normalizedUsedOrderId) && normalizedUsedOrderId > 0
        ? normalizedUsedOrderId
        : null,
    expiresAt: raw.expiresAt ?? '',
    createdAt: raw.createdAt ?? '',
  };
}

function normalizeAdminCustomOrderLinkDetail(raw: AdminCustomOrderLinkResponse): AdminCustomOrderLinkDetail {
  const summary = normalizeAdminCustomOrderLinkSummary(raw);

  return {
    ...summary,
    usedAt: raw.usedAt ?? null,
  };
}

function normalizeStoreCustomCheckoutLink(raw: StoreCustomCheckoutLinkResponse): StoreCustomCheckoutLink {
  const token = raw.token?.trim();

  if (!token) {
    throw new Error('커스텀 체크아웃 토큰이 응답에 없습니다.');
  }

  return {
    token,
    productName: raw.productName?.trim() || '커스텀 주문',
    finalTotalPrice: normalizeNumber(raw.finalTotalPrice, 0),
    expiresAt: raw.expiresAt ?? '',
    isExpired: normalizeBoolean(raw.isExpired, false),
  };
}

export const apiClient = {
  login: (loginId: string, password: string) =>
    request<{ admin: { adminId: number | string; loginId: string; name: string; role: AdminRole } }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ loginId, password }),
    }),

  logout: () =>
    request<{ loggedOut: boolean }>('/admin/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  me: () => request<AdminSession>('/admin/auth/me'),

  getAdminAccounts: () => request<{ items: AdminAccount[] }>('/admin/accounts'),

  createAdminAccount: (payload: AdminAccountCreatePayload) =>
    request<AdminAccount>('/admin/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminAccount: (adminId: number, payload: AdminAccountUpdatePayload) =>
    request<AdminAccount>(`/admin/accounts/${adminId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteAdminAccount: (adminId: number) =>
    request<{ deleted: boolean }>(`/admin/accounts/${adminId}`, {
      method: 'DELETE',
    }),

  getCategories: () => request<{ items: CategoryTreeNode[] }>('/store/categories'),

  getHomePopup: () => request<StoreHomePopup | null>('/store/home-popup'),

  getHomeHero: () => request<StoreHomeHero | null>('/store/home-hero'),

  getProducts: (query: { categorySlug?: string; q?: string; sort?: string; page?: number; size?: number }) =>
    request<{ items: ProductListItem[] } & { meta?: unknown }>(
      `/store/products${buildQueryString({
        categorySlug: query.categorySlug,
        q: query.q,
        sort: query.sort,
        page: query.page,
        size: query.size,
      })}`,
    ),

  getProductsWithMeta: (query: {
    categorySlug?: string;
    q?: string;
    sort?: string;
    page?: number;
    size?: number;
  }) =>
    requestWithMeta<{ items: ProductListItem[] }, PaginationMeta>(
      `/store/products${buildQueryString({
        categorySlug: query.categorySlug,
        q: query.q,
        sort: query.sort,
        page: query.page,
        size: query.size,
      })}`,
    ),

  getProductById: (productId: string) => request<ProductDetail>(`/store/products/${productId}`),

  getAdminCategories: () => request<{ items: AdminCategoryItem[] }>('/admin/categories'),

  createAdminCategory: (payload: AdminCategoryPayload) =>
    request<AdminCategoryItem>('/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminCategory: (categoryId: number, payload: Partial<AdminCategoryPayload>) =>
    request<AdminCategoryItem>(`/admin/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteAdminCategory: (categoryId: number) =>
    request<{ deleted: boolean }>(`/admin/categories/${categoryId}`, {
      method: 'DELETE',
    }),

  getAdminProducts: (query: AdminProductListQuery) =>
    requestWithMeta<{ items: AdminProductListItem[] }, PaginationMeta>(
      `/admin/products${buildQueryString({
        categoryId: query.categoryId,
        q: query.q,
        isVisible: query.isVisible,
        isSoldOut: query.isSoldOut,
        page: query.page,
        size: query.size,
      })}`,
    ),

  getAdminHomePopup: () => request<AdminHomePopup | null>('/admin/home-popup'),

  getAdminHomeHero: () => request<AdminHomeHero | null>('/admin/home-popup/hero-image'),

  upsertAdminHomePopup: (payload: AdminHomePopupPayload) =>
    request<AdminHomePopup>('/admin/home-popup', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  upsertAdminHomeHero: (payload: { imageUrl: string }) =>
    request<AdminHomeHero>('/admin/home-popup/hero-image', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  signAdminUpload: (payload: AdminMediaSignUploadPayload) =>
    request<AdminMediaSignedUpload>('/admin/media/sign-upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  finalizeAdminUpload: (payload: AdminMediaFinalizePayload) =>
    request<AdminMediaAsset>('/admin/media/finalize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteAdminUpload: (payload: AdminMediaDeletePayload) =>
    request<AdminMediaDeleteResult>('/admin/media/delete', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAdminProductById: (productId: string | number) => request<AdminProductDetail>(`/admin/products/${productId}`),

  createAdminProduct: (payload: AdminProductPayload) =>
    request<{ id: number; createdAt: string; updatedAt: string }>('/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminProduct: (productId: string | number, payload: Partial<AdminProductPayload>) =>
    request<{ id: number; updatedAt: string }>(`/admin/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteAdminProduct: (productId: string | number) =>
    request<{ deleted: boolean; deletedAt: string }>(`/admin/products/${productId}`, {
      method: 'DELETE',
    }),

  getAdminNotices: async (query: AdminNoticeListQuery) => {
    const result = await requestWithMeta<{ items: AdminNoticeListItem[] }, PaginationMeta>(
      `/admin/notices${buildQueryString({
        q: query.q,
        isPublished: query.isPublished,
        page: query.page,
        size: query.size,
      })}`,
    );

    return {
      data: {
        items: result.data.items,
      },
      meta: result.meta,
    };
  },

  getAdminNoticeById: (noticeId: string | number) => request<AdminNoticeDetail>(`/admin/notices/${noticeId}`),

  createAdminNotice: (payload: AdminNoticePayload) =>
    request<AdminNoticeDetail>('/admin/notices', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateAdminNotice: (noticeId: string | number, payload: Partial<AdminNoticePayload>) =>
    request<AdminNoticeDetail>(`/admin/notices/${noticeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteAdminNotice: (noticeId: string | number) =>
    request<{ deleted: boolean; deletedAt: string }>(`/admin/notices/${noticeId}`, {
      method: 'DELETE',
    }),

  getAdminOrders: async (query: AdminOrderListQuery) => {
    const result = await requestWithMeta<{ items: Array<Parameters<typeof normalizeAdminOrderListItem>[0]> }, PaginationMeta>(
      `/admin/orders${buildQueryString({
        q: query.q,
        orderStatus: query.orderStatus,
        page: query.page,
        size: query.size,
      })}`,
    );

    return {
      data: {
        items: result.data.items.map(normalizeAdminOrderListItem),
      },
      meta: result.meta,
    };
  },

  getAdminOrderById: async (orderId: string | number) => {
    const result = await request<AdminOrderDetailResponse | null>(`/admin/orders/${orderId}`);

    if (!result || typeof result !== 'object') {
      throw new Error('주문 상세 응답 형식이 올바르지 않습니다.');
    }

    return normalizeAdminOrderDetail(result);
  },

  updateAdminOrderStatus: (orderId: string | number, payload: AdminOrderStatusUpdatePayload) =>
    request<{ id?: number; orderId?: number; updatedAt?: string }>(`/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  updateAdminOrderShipment: (orderId: string | number, payload: AdminOrderShipmentUpdatePayload) =>
    request<{ id?: number; orderId?: number; updatedAt?: string }>(`/admin/orders/${orderId}/shipment`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  createAdminCustomOrderLink: async (payload: AdminCustomOrderLinkCreatePayload) => {
    const result = await request<AdminCustomOrderLinkResponse>('/admin/custom-orders/links', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return normalizeAdminCustomOrderLinkSummary(result);
  },

  getAdminCustomOrderLinkById: async (linkId: string | number) => {
    const result = await request<AdminCustomOrderLinkResponse>(`/admin/custom-orders/links/${linkId}`);

    return normalizeAdminCustomOrderLinkDetail(result);
  },

  getAdminCustomOrderLinks: async (limit = 10) => {
    const result = await request<AdminCustomOrderLinkListResponse>(`/admin/custom-orders/links${buildQueryString({ limit })}`);
    const items = Array.isArray(result.items) ? result.items : [];
    return items.map(normalizeAdminCustomOrderLinkSummary);
  },

  createOrder: (payload: StoreOrderCreateRequest) =>
    request<StoreOrderCreateResponse>('/store/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCustomCheckoutLinkByToken: async (token: string) => {
    const result = await request<StoreCustomCheckoutLinkResponse>(`/store/custom-checkout/${encodeURIComponent(token)}`);

    return normalizeStoreCustomCheckoutLink(result);
  },

  createCustomCheckoutOrder: (token: string, payload: StoreCustomCheckoutOrderCreateRequest) =>
    request<StoreOrderCreateResponse>(`/store/custom-checkout/${encodeURIComponent(token)}/orders`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOrderByNumber: (orderNumber: string) => request<StoreOrderLookupResponse>(`/store/orders/${encodeURIComponent(orderNumber)}`),

  requestDeposit: (orderNumber: string, payload?: StoreDepositRequestPayload) =>
    request<StoreDepositRequestResponse>(`/store/orders/${encodeURIComponent(orderNumber)}/deposit-requests`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  getOrderTracking: (orderNumber: string) =>
    request<StoreOrderTrackingResponse>(`/store/orders/${encodeURIComponent(orderNumber)}/tracking`),

  getStoreNotices: async () => {
    const result = await request<{ items: StoreNoticeListItem[] }>('/store/notices');
    return result.items;
  },

  getStoreNoticeById: (noticeId: string | number) => request<StoreNoticeDetail>(`/store/notices/${noticeId}`),
};
