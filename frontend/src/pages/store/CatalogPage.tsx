import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { ProductArtwork } from '../../components/store/ProductArtwork';
import { apiClient, CategoryTreeNode, ProductListItem } from '../../lib/api';

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

  const onMovePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  return (
    <main className="m-page catalog-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">{categorySlug || 'all'}</p>
        <h1 className="section-title">{titleCategoryName}</h1>
        <div className="hero-metrics">
          <span className="metric-chip">{meta.totalItems} items</span>
          {/* <span className="metric-chip">{sort === 'latest' ? '최신순' : sort === 'price_asc' ? '가격 낮은순' : '가격 높은순'}</span> */}
        </div>
      </section>

      {loading ? <LoadingScreen mode="inline" title="상품 목록 로딩 중" message="상품 목록을 불러오고 있습니다." /> : null}
      {error ? <p className="feedback-copy is-error">{error}</p> : null}

      {!loading && !error && products.length === 0 ? (
        <section className="surface-card empty-state">
          <p className="section-kicker">No Results</p>
          {/* <h2 className="section-subtitle">조건에 맞는 상품이 없습니다</h2> */}
          <p className="section-copy">등록된 상품이 없습니다.</p>
        </section>
      ) : null}

      {!loading && !error && products.length > 0 ? (
        <>
          <div className="catalog-grid">
            {products.map((product) => (
              <article className="product-tile" key={product.id}>
                <Link className="product-media" to={`/products/${product.id}`}>
                  <ProductArtwork src={product.thumbnailImageUrl} name={product.name} category={product.categoryName} />
                </Link>

                <div className="product-body">
                  <p className="section-kicker">{product.categoryName}</p>
                  <h2 className="product-name">
                    <Link to={`/products/${product.id}`}>{product.name}</Link>
                  </h2>
                  <p className="product-description">{product.shortDescription ?? '상품 설명이 준비 중입니다.'}</p>

                  <div className="product-meta-row">
                    <strong className="price-text">{formatCurrency(product.basePrice)}</strong>
                    <span className={`status-pill ${product.isSoldOut ? 'is-muted' : ''}`}>
                      {product.isSoldOut ? '품절' : '판매 중'}
                    </span>
                  </div>

                  <Link className="button button-secondary button-block" to={`/products/${product.id}`}>
                    상세 보기
                  </Link>
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
    </main>
  );
}
