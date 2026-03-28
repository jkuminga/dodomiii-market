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
};
