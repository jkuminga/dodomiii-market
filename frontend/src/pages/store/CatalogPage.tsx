import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ProductArtwork } from '../../components/store/ProductArtwork';
import { apiClient, CategoryTreeNode, ProductListItem } from '../../lib/api';

function flattenCategories(nodes: CategoryTreeNode[]): Array<{ slug: string; name: string }> {
  const result: Array<{ slug: string; name: string }> = [];

  const walk = (items: CategoryTreeNode[], prefix = '') => {
    for (const item of items) {
      result.push({
        slug: item.slug,
        name: prefix ? `${prefix} / ${item.name}` : item.name,
      });

      if (item.children.length > 0) {
        walk(item.children, prefix ? `${prefix} / ${item.name}` : item.name);
      }
    }
  };

  walk(nodes);

  return result;
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
  const q = searchParams.get('q') ?? '';
  const sort = searchParams.get('sort') ?? 'latest';
  const page = Number(searchParams.get('page') ?? '1');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const [categoriesResult, productsResult] = await Promise.all([
          apiClient.getCategories(),
          apiClient.getProductsWithMeta({
            categorySlug: categorySlug || undefined,
            q: q || undefined,
            sort,
            page,
            size: 12,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setCategories(categoriesResult.items);
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
  }, [categorySlug, page, q, sort]);

  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const nextQ = String(formData.get('q') ?? '').trim();
    const nextCategorySlug = String(formData.get('categorySlug') ?? '').trim();
    const nextSort = String(formData.get('sort') ?? 'latest');

    const next = new URLSearchParams();
    if (nextQ) next.set('q', nextQ);
    if (nextCategorySlug) next.set('categorySlug', nextCategorySlug);
    if (nextSort && nextSort !== 'latest') next.set('sort', nextSort);
    next.set('page', '1');

    setSearchParams(next);
  };

  const onMovePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  return (
    <main className="m-page catalog-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">Collection</p>
        <h1 className="section-title">상품 컬렉션</h1>
        <p className="section-copy">
          모바일에서 필터와 검색을 한 번에 조절할 수 있도록 상단에 정리했고, 각 상품 카드는 이미지와 가격 정보에 먼저
          집중하도록 재배치했습니다.
        </p>
        <div className="hero-metrics">
          <span className="metric-chip">{meta.totalItems} items</span>
          <span className="metric-chip">{sort === 'latest' ? '최신순' : sort === 'price_asc' ? '가격 낮은순' : '가격 높은순'}</span>
        </div>
      </section>

      <form className="surface-card filter-panel" onSubmit={onSearchSubmit}>
        <label className="field">
          <span>카테고리</span>
          <select name="categorySlug" defaultValue={categorySlug}>
            <option value="">전체</option>
            {categoryOptions.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>검색어</span>
          <input name="q" defaultValue={q} placeholder="상품명 검색" />
        </label>

        <label className="field">
          <span>정렬</span>
          <select name="sort" defaultValue={sort}>
            <option value="latest">최신순</option>
            <option value="price_asc">가격 낮은순</option>
            <option value="price_desc">가격 높은순</option>
          </select>
        </label>

        <button className="button button-block" type="submit">
          필터 적용
        </button>
      </form>

      {loading ? <p className="feedback-copy">상품 목록을 불러오는 중입니다.</p> : null}
      {error ? <p className="feedback-copy is-error">{error}</p> : null}

      {!loading && !error && products.length === 0 ? (
        <section className="surface-card empty-state">
          <p className="section-kicker">No Results</p>
          <h2 className="section-subtitle">조건에 맞는 상품이 없습니다</h2>
          <p className="section-copy">검색어나 카테고리를 바꾸면 바로 다시 조회할 수 있습니다.</p>
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
