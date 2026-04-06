import { CSSProperties, DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { apiClient, AdminCategoryItem, AdminCategoryPayload } from '../../lib/api';
import {
  AdminLayoutContext,
  buildAdminCategoryHierarchy,
  buildAdminCategoryOptions,
  formatAdminDateTime,
  sortAdminCategories,
} from './adminUtils';

type CategoryFormState = {
  parentId: string;
  name: string;
  slug: string;
  imageUrl: string;
  isOnLandingPage: boolean;
  sortOrder: string;
  isVisible: boolean;
};

function createEmptyForm(sortOrder = '0'): CategoryFormState {
  return {
    parentId: '',
    name: '',
    slug: '',
    imageUrl: '',
    isOnLandingPage: false,
    sortOrder,
    isVisible: true,
  };
}

function formFromCategory(category: AdminCategoryItem): CategoryFormState {
  return {
    parentId: category.parentId === null ? '' : String(category.parentId),
    name: category.name,
    slug: category.slug,
    imageUrl: category.imageUrl ?? '',
    isOnLandingPage: category.isOnLandingPage,
    sortOrder: String(category.sortOrder),
    isVisible: category.isVisible,
  };
}

function buildPayload(form: CategoryFormState, editingId: number | null): AdminCategoryPayload {
  const name = form.name.trim();
  const slug = form.slug.trim();
  const sortOrder = Number(form.sortOrder);
  const parentId = form.parentId ? Number(form.parentId) : null;

  if (!name) {
    throw new Error('카테고리명을 입력해주세요.');
  }

  if (!slug) {
    throw new Error('슬러그를 입력해주세요.');
  }

  if (!Number.isFinite(sortOrder)) {
    throw new Error('정렬 순서는 숫자로 입력해주세요.');
  }

  if (editingId !== null && parentId === editingId) {
    throw new Error('자기 자신을 상위 카테고리로 지정할 수 없습니다.');
  }

  return {
    parentId,
    name,
    slug,
    imageUrl: form.imageUrl.trim() || null,
    isOnLandingPage: form.isOnLandingPage,
    sortOrder,
    isVisible: form.isVisible,
  };
}

export function AdminCategoriesPage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();

  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [draftCategories, setDraftCategories] = useState<AdminCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [form, setForm] = useState<CategoryFormState>(createEmptyForm());
  const [draggingCategoryId, setDraggingCategoryId] = useState<number | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<number | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminCategories();
      setCategories(result.items);
      setDraftCategories(result.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '카테고리 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const hierarchicalCategories = useMemo(() => buildAdminCategoryHierarchy(draftCategories), [draftCategories]);
  const categoryGroups = useMemo(() => {
    const groups: Array<{
      root: (typeof hierarchicalCategories)[number];
      descendants: Array<(typeof hierarchicalCategories)[number]>;
    }> = [];
    const groupsByRootId = new Map<number, (typeof groups)[number]>();

    for (const item of hierarchicalCategories) {
      const existingGroup = groupsByRootId.get(item.rootCategoryId);

      if (!existingGroup) {
        const nextGroup = {
          root: item,
          descendants: [],
        };

        groups.push(nextGroup);
        groupsByRootId.set(item.rootCategoryId, nextGroup);
        continue;
      }

      if (item.category.id !== existingGroup.root.category.id) {
        existingGroup.descendants.push(item);
      }
    }

    return groups;
  }, [hierarchicalCategories]);
  const categoryOptions = useMemo(() => buildAdminCategoryOptions(draftCategories), [draftCategories]);
  const selectedCategory = draftCategories.find((category) => category.id === selectedCategoryId) ?? null;
  const selectedCategoryHierarchy = hierarchicalCategories.find((item) => item.category.id === selectedCategoryId) ?? null;
  const pendingSortChangeCount = useMemo(() => {
    if (categories.length === 0 || draftCategories.length === 0) {
      return 0;
    }

    const originalById = new Map(categories.map((category) => [category.id, category]));

    return draftCategories.reduce((count, category) => {
      const original = originalById.get(category.id);
      if (!original) {
        return count;
      }
      return count + (original.sortOrder !== category.sortOrder ? 1 : 0);
    }, 0);
  }, [categories, draftCategories]);
  const hasPendingSortChanges = pendingSortChangeCount > 0;

  const getNextSortOrder = (parentId: number | null, excludeCategoryId?: number | null): string => {
    const siblingCategories = draftCategories.filter((category) => {
      if (excludeCategoryId && category.id === excludeCategoryId) {
        return false;
      }
      return category.parentId === parentId;
    });

    if (siblingCategories.length === 0) {
      return '0';
    }

    const maxSortOrder = siblingCategories.reduce((max, category) => Math.max(max, category.sortOrder), Number.NEGATIVE_INFINITY);
    return String(maxSortOrder + 1);
  };

  useEffect(() => {
    if (selectedCategoryId === null) {
      return;
    }

    if (!selectedCategory) {
      setSelectedCategoryId(null);
      setForm(createEmptyForm(getNextSortOrder(null)));
    }
  }, [selectedCategory, selectedCategoryId]);

  useEffect(() => {
    if (selectedCategoryId !== null) {
      return;
    }

    setForm((current) => {
      const parentId = current.parentId ? Number(current.parentId) : null;
      const nextSortOrder = getNextSortOrder(parentId);

      if (current.sortOrder === nextSortOrder) {
        return current;
      }

      return {
        ...current,
        sortOrder: nextSortOrder,
      };
    });
  }, [draftCategories, selectedCategoryId]);

  const visibleCount = draftCategories.filter((category) => category.isVisible).length;
  const landingSelectedCount = draftCategories.filter((category) => category.isOnLandingPage).length;

  const onSelectCategory = (category: AdminCategoryItem) => {
    setSelectedCategoryId(category.id);
    setForm(formFromCategory(category));
    setError('');
  };

  const onResetForm = () => {
    setSelectedCategoryId(null);
    setForm(createEmptyForm(getNextSortOrder(null)));
    setError('');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = buildPayload(form, selectedCategoryId);

      if (selectedCategoryId === null) {
        const created = await apiClient.createAdminCategory(payload);
        showToast('카테고리를 생성했습니다.');
        await loadCategories();
        setSelectedCategoryId(created.id);
        setForm(formFromCategory(created));
      } else {
        const updated = await apiClient.updateAdminCategory(selectedCategoryId, payload);
        showToast('카테고리 정보를 저장했습니다.');
        await loadCategories();
        setSelectedCategoryId(updated.id);
        setForm(formFromCategory(updated));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '카테고리 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!selectedCategory) {
      return;
    }

    const confirmed = window.confirm(`'${selectedCategory.name}' 카테고리를 삭제하시겠습니까?`);

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await apiClient.deleteAdminCategory(selectedCategory.id);
      showToast('카테고리를 삭제했습니다.');
      setSelectedCategoryId(null);
      setForm(createEmptyForm(getNextSortOrder(null, selectedCategory.id)));
      await loadCategories();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '카테고리 삭제에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDragStartCategory = (event: DragEvent<HTMLElement>, categoryId: number) => {
    setDraggingCategoryId(categoryId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(categoryId));
  };

  const onDragEndCategory = () => {
    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
  };

  const onDragOverCategory = (event: DragEvent<HTMLElement>, categoryId: number) => {
    if (draggingCategoryId === null || draggingCategoryId === categoryId) {
      return;
    }

    const draggingCategory = draftCategories.find((category) => category.id === draggingCategoryId);
    const targetCategory = draftCategories.find((category) => category.id === categoryId);

    if (!draggingCategory || !targetCategory || draggingCategory.parentId !== targetCategory.parentId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverCategoryId(categoryId);
  };

  const onDropCategory = (event: DragEvent<HTMLElement>, targetCategoryId: number) => {
    event.preventDefault();

    const sourceCategoryId = draggingCategoryId ?? Number(event.dataTransfer.getData('text/plain'));
    setDragOverCategoryId(null);

    if (!Number.isFinite(sourceCategoryId) || sourceCategoryId === targetCategoryId || reordering) {
      return;
    }

    const sourceCategory = draftCategories.find((category) => category.id === sourceCategoryId);
    const targetCategory = draftCategories.find((category) => category.id === targetCategoryId);

    if (!sourceCategory || !targetCategory) {
      return;
    }

    if (sourceCategory.parentId !== targetCategory.parentId) {
      showToast('같은 상위 카테고리 안에서만 순서를 바꿀 수 있습니다.', 'info');
      return;
    }

    const siblings = sortAdminCategories(draftCategories.filter((category) => category.parentId === sourceCategory.parentId));
    const sourceIndex = siblings.findIndex((category) => category.id === sourceCategory.id);
    const targetIndex = siblings.findIndex((category) => category.id === targetCategory.id);

    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return;
    }

    const reorderedSiblings = [...siblings];
    const [movedItem] = reorderedSiblings.splice(sourceIndex, 1);
    reorderedSiblings.splice(targetIndex, 0, movedItem);

    const nextSortOrderById = new Map(reorderedSiblings.map((category, index) => [category.id, index]));

    setDraftCategories((current) =>
      current.map((category) => {
        const nextSortOrder = nextSortOrderById.get(category.id);
        if (nextSortOrder === undefined) {
          return category;
        }
        return {
          ...category,
          sortOrder: nextSortOrder,
        };
      }),
    );

    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
  };

  const onApplySortChanges = async () => {
    if (!hasPendingSortChanges || reordering) {
      return;
    }

    setReordering(true);
    setError('');

    try {
      const originalById = new Map(categories.map((category) => [category.id, category]));
      const changedCategories = draftCategories.filter((category) => {
        const original = originalById.get(category.id);
        return !!original && original.sortOrder !== category.sortOrder;
      });

      await Promise.all(
        changedCategories.map((category) =>
          apiClient.updateAdminCategory(category.id, {
            sortOrder: category.sortOrder,
          }),
        ),
      );

      showToast('카테고리 순서 변경사항을 적용했습니다.');
      await loadCategories();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '카테고리 순서 적용에 실패했습니다.');
      showToast('카테고리 순서 적용에 실패했습니다.', 'error');
    } finally {
      setReordering(false);
      setDraggingCategoryId(null);
      setDragOverCategoryId(null);
    }
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Categories</p>
          <h2 className="section-title admin-section-title">카테고리 관리</h2>
          <p className="section-copy">목록 조회와 생성, 수정, 삭제를 한 화면에서 처리할 수 있도록 폼과 목록을 분리했습니다.</p>
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>전체</span>
            <strong>{categories.length}</strong>
          </div>
          <div className="admin-stat-card">
            <span>노출 중</span>
            <strong>{visibleCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>비노출</span>
            <strong>{categories.length - visibleCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>랜딩 노출</span>
            <strong>{landingSelectedCount}/3</strong>
          </div>
        </div>
      </section>

      <div className="admin-two-column admin-category-layout">
        <section className="surface-card admin-card-stack admin-category-browser-card">
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">List</p>
              <h3 className="section-subtitle">카테고리 구조</h3>
            </div>

            <div className="inline-actions">
              <button
                className="button"
                type="button"
                onClick={() => void onApplySortChanges()}
                disabled={!hasPendingSortChanges || loading || submitting || reordering}
              >
                {reordering ? '적용 중...' : `순서 적용${hasPendingSortChanges ? ` (${pendingSortChangeCount})` : ''}`}
              </button>
              <button className="button button-secondary" type="button" onClick={onResetForm}>
                +
              </button>
              <AdminRefreshButton onClick={() => void loadCategories()} disabled={loading} />
            </div>
          </div>

          {loading ? <LoadingScreen mode="inline" title="카테고리 로딩 중" message="카테고리 목록을 불러오고 있습니다." /> : null}
          {!loading && error ? (
            <p className="feedback-copy is-error" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && hierarchicalCategories.length === 0 ? (
            <section className="admin-empty-state">
              <p className="section-kicker">Empty</p>
              <h4 className="section-subtitle">등록된 카테고리가 없습니다</h4>
              <p className="section-copy">오른쪽 입력 폼에서 첫 카테고리를 바로 생성할 수 있습니다.</p>
            </section>
          ) : null}

          {!loading && !error && categoryGroups.length > 0 ? (
            <div className="admin-category-group-list">
              {categoryGroups.map((group) => {
                const { root, descendants } = group;
                const groupNodeCount = descendants.length + 1;
                const isSelectedGroup = selectedCategoryHierarchy?.rootCategoryId === root.rootCategoryId;

                return (
                  <section key={root.category.id} className={`admin-category-group ${isSelectedGroup ? 'is-current' : ''}`}>
                    <button
                      type="button"
                      className={`admin-category-root-card ${selectedCategoryId === root.category.id ? 'is-active' : ''} ${
                        draggingCategoryId === root.category.id ? 'is-dragging' : ''
                      } ${dragOverCategoryId === root.category.id ? 'is-drag-over' : ''}`}
                      onClick={() => onSelectCategory(root.category)}
                      aria-pressed={selectedCategoryId === root.category.id}
                      draggable={!submitting && !reordering}
                      onDragStart={(event) => onDragStartCategory(event, root.category.id)}
                      onDragEnd={onDragEndCategory}
                      onDragOver={(event) => onDragOverCategory(event, root.category.id)}
                      onDrop={(event) => onDropCategory(event, root.category.id)}
                    >
                      <div className="admin-category-root-head">
                        <div className="admin-category-root-title">
                          <span className="admin-category-root-badge">{root.isOrphan ? 'ORPHAN' : '상위'}</span>
                          <strong>{root.category.name}</strong>
                        </div>
                        {/* <span className="admin-category-group-size">노드 {groupNodeCount}</span> */}
                      </div>

                      <div className="admin-category-root-meta">
                        <span className="admin-category-depth-badge">하위</span>
                        <span>{root.hasChildren ? `하위 ${root.childCount}개` : '하위 디렉토리 없음'}</span>
                        {!root.category.isVisible ? <span className="admin-category-hidden-indicator">숨김</span> : null}
                        {root.category.isOnLandingPage ? <span className="admin-category-hidden-indicator">랜딩 노출</span> : null}
                        {root.isOrphan ? <span className="admin-category-tree-warning">상위 누락</span> : null}
                      </div>
                    </button>

                    {descendants.length > 0 ? (
                      <div className="admin-list-grid admin-category-tree-list">
                        {descendants.map((item) => {
                          const { category, childCount, depth } = item;

                          return (
                            <button
                              key={category.id}
                              type="button"
                              className={`admin-list-card admin-category-tree-card ${selectedCategoryId === category.id ? 'is-active' : ''}`}
                              onClick={() => onSelectCategory(category)}
                              aria-pressed={selectedCategoryId === category.id}
                              style={{ '--category-depth': depth } as CSSProperties}
                              draggable={!submitting && !reordering}
                              onDragStart={(event) => onDragStartCategory(event, category.id)}
                              onDragEnd={onDragEndCategory}
                              onDragOver={(event) => onDragOverCategory(event, category.id)}
                              onDrop={(event) => onDropCategory(event, category.id)}
                            >
                              <div className="admin-category-tree-shell">
                                <span className="admin-category-branch" aria-hidden="true">
                                  <span className="admin-category-branch-dot" />
                                </span>

                                <div className="admin-category-tree-content">
                                  <div
                                    className={`admin-category-tree-row ${draggingCategoryId === category.id ? 'is-dragging' : ''} ${
                                      dragOverCategoryId === category.id ? 'is-drag-over' : ''
                                    }`}
                                  >
                                    <div className="admin-category-tree-title">
                                      <span className="admin-category-depth-badge">D{depth + 1}</span>
                                      <strong>{category.name}</strong>
                                    </div>

                                    <div className="admin-category-tree-indicators">
                                      {childCount > 0 ? <span className="admin-category-child-count">하위 {childCount}</span> : null}
                                      {!category.isVisible ? <span className="admin-category-hidden-indicator">숨김</span> : null}
                                      {category.isOnLandingPage ? <span className="admin-category-hidden-indicator">랜딩 노출</span> : null}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="admin-category-group-empty">-</p>
                    )}
                  </section>
                );
              })}
            </div>
          ) : null}
        </section>

        <form className="surface-card admin-card-stack admin-editor-card" onSubmit={onSubmit}>
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">{selectedCategory ? 'Edit' : 'Create'}</p>
              <h3 className="section-subtitle">{selectedCategory ? '카테고리 수정' : '카테고리 생성'}</h3>
            </div>
            {selectedCategory ? (
              <span className="admin-inline-note">생성 {formatAdminDateTime(selectedCategory.createdAt)}</span>
            ) : null}
          </div>

          {selectedCategoryHierarchy ? (
            <div className="admin-editor-overview-bar admin-category-editor-overview">
              <div className="admin-overview-chip">
                <span>선택 경로</span>
                <strong>{selectedCategoryHierarchy.pathLabel}</strong>
              </div>
              <div className="admin-overview-chip">
                <span>구조</span>
                <strong>
                  {selectedCategoryHierarchy.depth + 1}단계
                  {selectedCategoryHierarchy.hasChildren ? ` · 하위 ${selectedCategoryHierarchy.childCount}개` : ' · 말단 카테고리'}
                </strong>
              </div>
            </div>
          ) : null}

          <label className="field">
            <span>상위 카테고리</span>
            <select
              value={form.parentId}
              onChange={(event) => {
                const nextParentId = event.target.value;

                setForm((current) => {
                  if (selectedCategoryId !== null) {
                    return {
                      ...current,
                      parentId: nextParentId,
                    };
                  }

                  const parentId = nextParentId ? Number(nextParentId) : null;

                  return {
                    ...current,
                    parentId: nextParentId,
                    sortOrder: getNextSortOrder(parentId),
                  };
                });
              }}
            >
              <option value="">최상위</option>
              {categoryOptions
                .filter((item) => item.value !== selectedCategoryId)
                .map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            <span>카테고리명</span>
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>

          <label className="field">
            <span>슬러그</span>
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="bouquet"
            />
          </label>

          <label className="field">
            <span>대표 이미지 URL</span>
            <input
              value={form.imageUrl}
              onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
              placeholder="https://..."
            />
          </label>

          <label className="field">
            <span>정렬 순서</span>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
            />
          </label>

          <label className="admin-check-field">
            <input
              type="checkbox"
              checked={form.isVisible}
              onChange={(event) => setForm((current) => ({ ...current, isVisible: event.target.checked }))}
            />
            <span>스토어에 노출</span>
          </label>

          <label className="admin-check-field">
            <input
              type="checkbox"
              checked={form.isOnLandingPage}
              onChange={(event) => setForm((current) => ({ ...current, isOnLandingPage: event.target.checked }))}
            />
            <span>랜딩 페이지 카테고리 섹션에 노출 (최대 3개)</span>
          </label>

          {error ? (
            <p className="feedback-copy is-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="inline-actions">
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? '저장 중...' : selectedCategory ? '카테고리 저장' : '카테고리 생성'}
            </button>
            {selectedCategory ? (
              <button className="button button-ghost" type="button" onClick={() => void onDelete()} disabled={submitting}>
                삭제
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
