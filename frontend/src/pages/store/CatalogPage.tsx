import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { ProductArtwork } from '../../components/store/ProductArtwork';
import { apiClient, CategoryTreeNode, ProductListItem } from '../../lib/api';
import { calculateDiscountedPrice, formatDiscountRate } from '../../lib/productPricing';
import logoMainImage from '../../assets/images/logo_main3.jpg';

function findCategoryNameBySlug(nodes: CategoryTreeNode[], slug: string): string | null {
  for (const node of nodes) {
    if (node.slug === slug) {
      return node.name;
    }
    if (node.children.length > 0) {
      const found = findCategoryNameBySlug(node.children, slug);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function findCategoryNodeBySlug(nodes: CategoryTreeNode[], slug: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.slug === slug) {
      return node;
    }

    if (node.children.length > 0) {
      const found = findCategoryNodeBySlug(node.children, slug);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function categoryTreeContainsSlug(node: CategoryTreeNode, slug: string): boolean {
  if (node.slug === slug) {
    return true;
  }

  return node.children.some((child) => categoryTreeContainsSlug(child, slug));
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, size: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const categorySlug = searchParams.get('categorySlug') ?? '';
  const sort = searchParams.get('sort') ?? 'latest';
  const page = Number(searchParams.get('page') ?? '1');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const categoriesResult = await apiClient.getCategories();
        if (cancelled) {
          return;
        }

        setCategories(categoriesResult.items);
      } catch {
        // Keep fallback title when category list loading fails.
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const productsResult = await apiClient.getProductsWithMeta({
          categorySlug: categorySlug || undefined,
          sort,
          page,
          size: 12,
        });

        if (cancelled) {
          return;
        }

        setProducts(productsResult.data.items);
        setMeta(productsResult.meta);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '목록 조회 중 오류가 발생했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [categorySlug, page, sort]);

  const titleCategoryName = useMemo(() => {
    if (!categorySlug) {
      return '전체 상품';
    }

    return findCategoryNameBySlug(categories, categorySlug) ?? '상품';
  }, [categories, categorySlug]);

  const showCustomBouquetItem = useMemo(() => {
    if (!categorySlug) {
      return false;
    }

    const bouquetCategory = findCategoryNodeBySlug(categories, 'bouquet');
    if (!bouquetCategory) {
      return categorySlug === 'bouquet';
    }

    return categoryTreeContainsSlug(bouquetCategory, categorySlug);
  }, [categories, categorySlug]);

  const hasVisibleItems = showCustomBouquetItem || products.length > 0;

  const onMovePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  return (
    <main className="m-page catalog-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">{categorySlug || 'all'}</p>
        <div className="section-title-row">
          <h1 className="section-title">{titleCategoryName}</h1>
          <span className="metric-chip">{meta.totalItems} items</span>
        </div>
      </section>

      {loading ? <LoadingScreen mode="inline" title="상품 목록 로딩 중" message="상품 목록을 불러오고 있습니다." /> : null}
      {error ? <p className="feedback-copy is-error">{error}</p> : null}

      {!loading && !error && !hasVisibleItems ? (
        <section className="surface-card empty-state">
          <p className="section-kicker">No Results</p>
          {/* <h2 className="section-subtitle">조건에 맞는 상품이 없습니다</h2> */}
          <p className="section-copy">등록된 상품이 없습니다.</p>
        </section>
      ) : null}

      {!loading && !error && hasVisibleItems ? (
        <>
          <div className="catalog-grid">
            {showCustomBouquetItem ? (
              <Link className="product-tile" key="custom-bouquet-order-item" to="/products/custom-order">
                <div className="product-media">
                  <ProductArtwork src={logoMainImage} name="커스텀 주문용 상품" category="꽃다발" />
                  <span className="status-pill">상시 접수</span>
                </div>

                <div className="product-body">
                  <p className="section-kicker-category">꽃다발</p>
                  <h2 className="product-name">커스텀 주문용 상품</h2>
                  <p className="product-description">원하는 색감/구성/예산에 맞춰 꽃다발을 맞춤 제작합니다.</p>

                  <div className="product-meta-row">
                    <strong className="price-text">상담 후 견적</strong>
                  </div>
                </div>
              </Link>
            ) : null}

            {products.map((product) => {
              const discountedPrice = calculateDiscountedPrice(product.basePrice, product.discountRate);
              const hasDiscount = product.discountRate > 0 && discountedPrice < product.basePrice;

              return (
              <Link className="product-tile" key={product.id} to={`/products/${product.id}`}>
                <div className="product-media">
                  <ProductArtwork src={product.thumbnailImageUrl} name={product.name} category={product.categoryName} />
                  <span className={`status-pill ${product.isSoldOut ? 'is-muted' : ''}`}>
                    {product.isSoldOut ? '품절' : '판매 중'}
                  </span>
                </div>

                <div className="product-body">
                  <p className="section-kicker-category">{product.categoryName}</p>
                  <h2 className="product-name">{product.name}</h2>
                  <p className="product-description">{product.shortDescription ?? '상품 설명이 준비 중입니다.'}</p>

                  <div className="product-meta-row">
                    <div className="product-price-stack">
                      {hasDiscount ? (
                        <>
                        <strong className="price-text">{formatCurrency(discountedPrice)}</strong>
                        <span className="product-original-price">{formatCurrency(product.basePrice)}</span>
                        </>
                      ) : (
                        <strong className="price-text">{formatCurrency(product.basePrice)}</strong>
                      )}
                    </div>
                    {hasDiscount ? <span className="product-discount-rate">{formatDiscountRate(product.discountRate)}</span> : null}
                  </div>
                </div>
              </Link>
              );
            })}
          </div>

          {products.length > 0 ? (
            <div className="pagination-bar">
              <button
                className="button button-ghost pagination-btn"
                type="button"
                onClick={() => onMovePage(meta.page - 1)}
                disabled={meta.page <= 1}
                aria-label="이전 페이지"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="pagination-status">
                {meta.page} / {meta.totalPages || 1}
              </span>
              <button
                className="button button-ghost pagination-btn"
                type="button"
                onClick={() => onMovePage(meta.page + 1)}
                disabled={meta.totalPages === 0 || meta.page >= meta.totalPages}
                aria-label="다음 페이지"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
