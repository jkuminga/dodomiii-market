import { AdminCategoryItem, AdminSession } from '../../lib/api';

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
