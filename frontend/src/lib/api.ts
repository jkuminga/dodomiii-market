const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000/api/v1';

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
    throw new Error(body.error?.message ?? '요청 처리 중 오류가 발생했습니다.');
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

export type CategoryTreeNode = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  sortOrder: number;
  children: CategoryTreeNode[];
};

export type AdminCategoryItem = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCategoryPayload = {
  parentId: number | null;
  name: string;
  slug: string;
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
  options: Array<{
    id: number;
    optionGroupName: string;
    optionValue: string;
    extraPrice: number;
    isActive: boolean;
    sortOrder: number;
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
  createdAt: string;
  updatedAt: string;
};

export type AdminProductImageInput = {
  imageType: 'THUMBNAIL' | 'DETAIL';
  imageUrl: string;
  sortOrder: number;
};

export type AdminProductOptionInput = {
  optionGroupName: string;
  optionValue: string;
  extraPrice: number;
  isActive: boolean;
  sortOrder: number;
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
  options: AdminProductOptionInput[];
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
  options: Array<{
    id: number;
    optionGroupName: string;
    optionValue: string;
    extraPrice: number;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
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
    productOptionId?: number;
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
  depositStatus: StoreDepositStatus;
  requestedAt: string | null;
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

  getCategories: () => request<{ items: CategoryTreeNode[] }>('/store/categories'),

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

  createOrder: (payload: StoreOrderCreateRequest) =>
    request<StoreOrderCreateResponse>('/store/orders', {
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
};
