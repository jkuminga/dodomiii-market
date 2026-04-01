import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';

import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { apiClient, AdminCategoryItem, AdminProductListItem, PaginationMeta } from '../../lib/api';
import { AdminLayoutContext, buildAdminCategoryOptions, formatAdminDateTime, formatCurrency, getAdminCategoryLabel } from './adminUtils';

function parseBooleanFilter(value: string | null): boolean | undefined {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

export function AdminProductsPage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, size: 10, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const categoryIdParam = searchParams.get('categoryId') ?? '';
  const q = searchParams.get('q') ?? '';
  const isVisibleParam = searchParams.get('isVisible') ?? 'all';
  const isSoldOutParam = searchParams.get('isSoldOut') ?? 'all';
  const page = Number(searchParams.get('page') ?? '1');

  const loadProducts = async () => {
    setLoading(true);
    setError('');

    try {
      const [categoriesResult, productsResult] = await Promise.all([
        apiClient.getAdminCategories(),
        apiClient.getAdminProducts({
          categoryId: categoryIdParam ? Number(categoryIdParam) : undefined,
          q: q || undefined,
          isVisible: parseBooleanFilter(isVisibleParam === 'all' ? null : isVisibleParam),
          isSoldOut: parseBooleanFilter(isSoldOutParam === 'all' ? null : isSoldOutParam),
          page,
          size: 10,
        }),
      ]);

      setCategories(categoriesResult.items);
      setProducts(productsResult.data.items);
      setMeta(productsResult.meta);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '상품 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [categoryIdParam, isSoldOutParam, isVisibleParam, page, q]);

  const categoryOptions = useMemo(() => buildAdminCategoryOptions(categories), [categories]);

  const onFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const next = new URLSearchParams();
    const nextCategoryId = String(formData.get('categoryId') ?? '').trim();
    const nextQuery = String(formData.get('q') ?? '').trim();
    const nextVisible = String(formData.get('isVisible') ?? 'all');
    const nextSoldOut = String(formData.get('isSoldOut') ?? 'all');

    if (nextCategoryId) {
      next.set('categoryId', nextCategoryId);
    }

    if (nextQuery) {
      next.set('q', nextQuery);
    }

    if (nextVisible !== 'all') {
      next.set('isVisible', nextVisible);
    }

    if (nextSoldOut !== 'all') {
      next.set('isSoldOut', nextSoldOut);
    }

    next.set('page', '1');
    setSearchParams(next);
  };

  const onMovePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const onDelete = async (product: AdminProductListItem) => {
    const confirmed = window.confirm(`'${product.name}' 상품을 삭제하시겠습니까?`);

    if (!confirmed) {
      return;
    }

    setDeletingId(product.id);
    setError('');

    try {
      await apiClient.deleteAdminProduct(product.id);
      showToast('상품을 삭제했습니다.');

      if (products.length === 1 && page > 1) {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(page - 1));
        setSearchParams(next);
      } else {
        await loadProducts();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '상품 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Products</p>
          <h2 className="section-title admin-section-title">상품 관리</h2>
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>검색 결과</span>
            <strong>{meta.totalItems}</strong>
          </div>
          <div className="admin-stat-card">
            <span>현재 페이지</span>
            <strong>{meta.page}</strong>
          </div>
          <div className="admin-stat-card">
            <span>총 페이지</span>
            <strong>{meta.totalPages || 1}</strong>
          </div>
        </div>
      </section>

      <form className="surface-card admin-card-stack admin-filter-panel" onSubmit={onFilterSubmit}>
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">Filters</p>
            <h3 className="section-subtitle">상품 조회 조건</h3>
          </div>
          <Link className="button" to="/admin/products/new">
            상품 등록
          </Link>
        </div>

        <div className="admin-field-grid">
          <label className="field">
            <span>카테고리</span>
            <select name="categoryId" defaultValue={categoryIdParam}>
              <option value="">전체</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>검색어</span>
            <input name="q" defaultValue={q} placeholder="상품명 또는 슬러그 검색" />
          </label>

          <label className="field">
            <span>노출 상태</span>
            <select name="isVisible" defaultValue={isVisibleParam}>
              <option value="all">전체</option>
              <option value="true">노출</option>
              <option value="false">비노출</option>
            </select>
          </label>

          <label className="field">
            <span>판매 상태</span>
            <select name="isSoldOut" defaultValue={isSoldOutParam}>
              <option value="all">전체</option>
              <option value="false">판매 가능</option>
              <option value="true">품절</option>
            </select>
          </label>
        </div>

        <div className="inline-actions">
          <button className="button" type="submit">
            조건 적용
          </button>
          <AdminRefreshButton onClick={() => void loadProducts()} disabled={loading} />
        </div>
      </form>

      <section className="surface-card admin-card-stack">
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">List</p>
            <h3 className="section-subtitle">상품 목록</h3>
          </div>
          <span className="admin-inline-note">{meta.totalItems}건</span>
        </div>

        {loading ? <LoadingScreen mode="inline" title="상품 목록 로딩 중" message="상품 목록을 불러오고 있습니다." /> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && products.length === 0 ? (
          <section className="admin-empty-state">
            <p className="section-kicker">Empty</p>
            <h4 className="section-subtitle">조건에 맞는 상품이 없습니다</h4>
            <p className="section-copy">필터를 바꾸거나 새 상품을 등록해 목록을 채울 수 있습니다.</p>
          </section>
        ) : null}

        {!loading && !error && products.length > 0 ? (
          <>
            <div className="admin-list-grid">
              {products.map((product) => (
                <article className="admin-list-card admin-product-list-card" key={product.id}>
                  <div className="admin-list-card-head">
                    <div>
                      <strong>{product.name}</strong>
                      <p>{getAdminCategoryLabel(product.categoryId, categories)}</p>
                    </div>
                    <div className="admin-pill-row">
                      <span className={`status-pill ${product.isVisible ? '' : 'is-muted'}`}>{product.isVisible ? '노출' : '숨김'}</span>
                      <span className={`status-pill ${product.isSoldOut ? 'is-muted' : ''}`}>{product.isSoldOut ? '품절' : '판매중'}</span>
                    </div>
                  </div>

                  <div className="admin-product-summary">
                    <span>{formatCurrency(product.basePrice)}</span>
                    <span>{product.stockQuantity === null ? '재고 추적 안 함' : `재고 ${product.stockQuantity}개`}</span>
                  </div>

                  <div className="admin-meta-row">
                    <span>{product.slug}</span>
                    <span>{product.consultationRequired ? '상담 필요' : '일반 주문'}</span>
                  </div>

                  <small>수정 {formatAdminDateTime(product.updatedAt)}</small>

                  <div className="inline-actions">
                    <Link className="button button-secondary" to={`/admin/products/${product.id}`}>
                      상세/수정
                    </Link>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => void onDelete(product)}
                      disabled={deletingId === product.id}
                    >
                      {deletingId === product.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="pagination-bar">
              <button className="button button-ghost" type="button" onClick={() => onMovePage(meta.page - 1)} disabled={meta.page <= 1}>
                이전
              </button>
              <span className="pagination-status">
                {meta.page} / {meta.totalPages || 1}
              </span>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => onMovePage(meta.page + 1)}
                disabled={meta.totalPages === 0 || meta.page >= meta.totalPages}
              >
                다음
              </button>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
