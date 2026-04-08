import {
  AdminCategoryItem,
  AdminSession,
  StoreDepositStatus,
  StoreOrderStatus,
  StoreShipmentStatus,
} from '../../lib/api';

export type AdminToastTone = 'success' | 'error' | 'info';

export type AdminToast = {
  id: number;
  message: string;
  tone: AdminToastTone;
};

export type AdminLayoutContext = {
  admin: AdminSession;
  showToast: (message: string, tone?: AdminToastTone) => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

export type AdminCategoryHierarchyItem = {
  category: AdminCategoryItem;
  depth: number;
  rootCategoryId: number;
  rootCategoryName: string;
  pathNames: string[];
  pathLabel: string;
  parentPathLabel: string;
  hasChildren: boolean;
  childCount: number;
  isOrphan: boolean;
};

export function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function formatAdminDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatAdminPhone(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const digits = value.replace(/\D/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value;
}

export function getOrderStatusLabel(status: StoreOrderStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return '입금 대기';
    case 'PAYMENT_REQUESTED':
      return '입금 요청 확인 중';
    case 'PAYMENT_CONFIRMED':
      return '입금 확인 완료';
    case 'PREPARING':
      return '상품 준비 중';
    case 'SHIPPED':
      return '배송 중';
    case 'DELIVERED':
      return '배송 완료';
    case 'CANCELLED':
      return '주문 취소';
    case 'EXPIRED':
      return '입금 기한 만료';
    default:
      return status;
  }
}

export function getDepositStatusLabel(status: StoreDepositStatus): string {
  switch (status) {
    case 'WAITING':
      return '입금 대기';
    case 'REQUESTED':
      return '입금 확인 요청 접수';
    case 'CONFIRMED':
      return '입금 확인 완료';
    case 'REJECTED':
      return '입금 재확인 필요';
    default:
      return status;
  }
}

export function getShipmentStatusLabel(status: StoreShipmentStatus): string {
  switch (status) {
    case 'READY':
      return '배송 전';
    case 'SHIPPED':
      return '배송 중';
    case 'DELIVERED':
      return '배송 완료';
    default:
      return status;
  }
}

export function getShipmentStatusPillClass(status: StoreShipmentStatus): string {
  switch (status) {
    case 'READY':
      return 'is-shipment-ready';
    case 'SHIPPED':
      return 'is-shipment-shipped';
    case 'DELIVERED':
      return 'is-shipment-delivered';
    default:
      return '';
  }
}

const ADMIN_ALLOWED_NEXT_ORDER_STATUSES: Record<StoreOrderStatus, StoreOrderStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_REQUESTED', 'EXPIRED', 'CANCELLED'],
  PAYMENT_REQUESTED: ['PAYMENT_CONFIRMED', 'CANCELLED'],
  PAYMENT_CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function getAllowedNextOrderStatuses(status: StoreOrderStatus): StoreOrderStatus[] {
  return [...ADMIN_ALLOWED_NEXT_ORDER_STATUSES[status]];
}

function buildCategoryPath(id: number, itemsById: Map<number, AdminCategoryItem>, visited = new Set<number>()): string {
  const item = itemsById.get(id);

  if (!item || visited.has(id)) {
    return '';
  }

  visited.add(id);

  if (item.parentId === null) {
    return item.name;
  }

  const parentPath = buildCategoryPath(item.parentId, itemsById, visited);
  return parentPath ? `${parentPath} / ${item.name}` : item.name;
}

export function buildAdminCategoryHierarchy(items: AdminCategoryItem[]): AdminCategoryHierarchyItem[] {
  const sortedItems = sortAdminCategories(items);
  const itemsById = new Map(sortedItems.map((item) => [item.id, item]));
  const childrenByParentId = new Map<number, AdminCategoryItem[]>();
  const rootItems: AdminCategoryItem[] = [];

  for (const item of sortedItems) {
    if (item.parentId === null || !itemsById.has(item.parentId)) {
      rootItems.push(item);
      continue;
    }

    const siblings = childrenByParentId.get(item.parentId) ?? [];
    siblings.push(item);
    childrenByParentId.set(item.parentId, siblings);
  }

  childrenByParentId.forEach((children, parentId) => {
    childrenByParentId.set(parentId, sortAdminCategories(children));
  });

  const visited = new Set<number>();
  const hierarchy: AdminCategoryHierarchyItem[] = [];

  const walk = (item: AdminCategoryItem, depth: number, ancestors: string[], rootCategory: AdminCategoryItem) => {
    if (visited.has(item.id)) {
      return;
    }

    visited.add(item.id);

    const pathNames = [...ancestors, item.name];
    const childItems = childrenByParentId.get(item.id) ?? [];

    hierarchy.push({
      category: item,
      depth,
      rootCategoryId: rootCategory.id,
      rootCategoryName: rootCategory.name,
      pathNames,
      pathLabel: pathNames.join(' / '),
      parentPathLabel: ancestors.join(' / ') || '최상위',
      hasChildren: childItems.length > 0,
      childCount: childItems.length,
      isOrphan: item.parentId !== null && !itemsById.has(item.parentId),
    });

    for (const child of childItems) {
      walk(child, depth + 1, pathNames, rootCategory);
    }
  };

  for (const item of sortAdminCategories(rootItems)) {
    walk(item, 0, [], item);
  }

  for (const item of sortedItems) {
    if (!visited.has(item.id)) {
      walk(item, 0, [], item);
    }
  }

  return hierarchy;
}

export function sortAdminCategories(items: AdminCategoryItem[]): AdminCategoryItem[] {
  return [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.name.localeCompare(right.name, 'ko-KR');
  });
}

export function buildAdminCategoryOptions(items: AdminCategoryItem[]): Array<{ value: number; label: string }> {
  return buildAdminCategoryHierarchy(items).map((item) => ({
    value: item.category.id,
    label: item.pathLabel,
  }));
}

export function getAdminCategoryLabel(categoryId: number | null | undefined, items: AdminCategoryItem[]): string {
  if (categoryId === null || categoryId === undefined) {
    return '최상위';
  }

  const itemsById = new Map(items.map((item) => [item.id, item]));
  return buildCategoryPath(categoryId, itemsById) || `#${categoryId}`;
}
