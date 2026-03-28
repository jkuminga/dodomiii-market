const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000/api/v1';

type ApiErrorShape = {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as ApiErrorShape & { data?: T };

  if (!response.ok || body.success === false) {
    throw new Error(body.error?.message ?? '요청 처리 중 오류가 발생했습니다.');
  }

  if (!body.data) {
    throw new Error('응답 데이터가 비어 있습니다.');
  }

  return body.data;
}

export type CategoryTreeNode = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  sortOrder: number;
  children: CategoryTreeNode[];
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
    request<{ admin: { adminId: string; loginId: string; name: string; role: 'SUPER' | 'STAFF' } }>(
      '/admin/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ loginId, password }),
      },
    ),

  logout: () =>
    request<{ loggedOut: boolean }>('/admin/auth/logout', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  me: () =>
    request<{
      adminId: string;
      loginId: string;
      name: string;
      role: 'SUPER' | 'STAFF';
      isActive: boolean;
    }>('/admin/auth/me'),

  getCategories: () =>
    request<{ items: CategoryTreeNode[] }>('/store/categories'),

  getProducts: (query: { categorySlug?: string; q?: string; sort?: string; page?: number; size?: number }) => {
    const params = new URLSearchParams();

    if (query.categorySlug) params.set('categorySlug', query.categorySlug);
    if (query.q) params.set('q', query.q);
    if (query.sort) params.set('sort', query.sort);
    if (query.page) params.set('page', String(query.page));
    if (query.size) params.set('size', String(query.size));

    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';

    return request<{ items: ProductListItem[] } & { meta?: unknown }>(`/store/products${suffix}`);
  },

  getProductsWithMeta: async (query: {
    categorySlug?: string;
    q?: string;
    sort?: string;
    page?: number;
    size?: number;
  }) => {
    const params = new URLSearchParams();

    if (query.categorySlug) params.set('categorySlug', query.categorySlug);
    if (query.q) params.set('q', query.q);
    if (query.sort) params.set('sort', query.sort);
    if (query.page) params.set('page', String(query.page));
    if (query.size) params.set('size', String(query.size));

    const response = await fetch(`${BASE_URL}/store/products?${params.toString()}`, {
      credentials: 'include',
    });

    const body = (await response.json()) as {
      success: boolean;
      data: { items: ProductListItem[] };
      meta: { page: number; size: number; totalItems: number; totalPages: number };
      error?: { message?: string };
    };

    if (!response.ok || !body.success) {
      throw new Error(body.error?.message ?? '상품 목록 조회 중 오류가 발생했습니다.');
    }

    return body;
  },

  getProductById: (productId: string) =>
    request<ProductDetail>(`/store/products/${productId}`),

  createOrder: (payload: StoreOrderCreateRequest) =>
    request<StoreOrderCreateResponse>('/store/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOrderByNumber: (orderNumber: string) =>
    request<StoreOrderLookupResponse>(`/store/orders/${encodeURIComponent(orderNumber)}`),

  requestDeposit: (orderNumber: string, payload?: StoreDepositRequestPayload) =>
    request<StoreDepositRequestResponse>(`/store/orders/${encodeURIComponent(orderNumber)}/deposit-requests`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  getOrderTracking: (orderNumber: string) =>
    request<StoreOrderTrackingResponse>(`/store/orders/${encodeURIComponent(orderNumber)}/tracking`),
};
