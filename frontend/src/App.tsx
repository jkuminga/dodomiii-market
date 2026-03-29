import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import logoMain from './assets/images/logo_main3.jpg';
import { BottomNav } from './components/mobile/BottomNav';
import { MobileHeader } from './components/mobile/MobileHeader';
import { ProductArtwork } from './components/store/ProductArtwork';
import { apiClient, CategoryTreeNode, ProductListItem } from './lib/api';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminCustomOrdersPage } from './pages/admin/AdminCustomOrdersPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminProductEditorPage } from './pages/admin/AdminProductEditorPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { CatalogPage } from './pages/store/CatalogPage';
import { CustomCheckoutPage } from './pages/store/CustomCheckoutPage';
import { OrderLookupPage } from './pages/store/OrderLookupPage';
import { OrderPage } from './pages/store/OrderPage';
import { ProductDetailPage } from './pages/store/ProductDetailPage';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function collectCategoryLinks(nodes: CategoryTreeNode[]): Array<{ slug: string; name: string }> {
  const result: Array<{ slug: string; name: string }> = [];

  const walk = (items: CategoryTreeNode[]) => {
    for (const item of items) {
      result.push({ slug: item.slug, name: item.name });
      if (result.length >= 6) {
        return;
      }
      if (item.children.length > 0) {
        walk(item.children);
      }
      if (result.length >= 6) {
        return;
      }
    }
  };

  walk(nodes);

  return result;
}

function HomePage() {
  const [categories, setCategories] = useState<Array<{ slug: string; name: string }>>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const startedAt = Date.now();
      setLoading(true);
      setError('');

      try {
        const [categoriesResult, productsResult] = await Promise.all([
          apiClient.getCategories(),
          apiClient.getProducts({ sort: 'latest', size: 4 }),
        ]);

        if (cancelled) {
          return;
        }

        setCategories(collectCategoryLinks(categoriesResult.items));
        setFeaturedProducts(productsResult.items.slice(0, 4));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '홈 화면을 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        const elapsed = Date.now() - startedAt;
        const delay = Math.max(0, 220 - elapsed);
        await new Promise((resolve) => window.setTimeout(resolve, delay));

        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <main className="m-page home-page">
      <section className="surface-hero hero-stage">
        <div className="hero-copy hero-copy-polished">
          <div className="hero-art hero-art-prominent" aria-hidden="true">
            <div className="hero-art-blur hero-art-blur-left" />
            <div className="hero-art-blur hero-art-blur-right" />
            <div className="hero-art-ring hero-art-ring-outer" />
            <div className="hero-art-ring hero-art-ring-inner" />
            <div className="hero-logo-shadow" />
            <div className="hero-logo-wrap">
              <img className="hero-logo-image" src={logoMain} alt="" />
            </div>
            <div className="hero-art-note">DODOMII MARKET</div>
          </div>

          <h1 className="section-title hero-title">꽃다발처럼 남는 선물</h1>
          <p className="section-copy hero-summary">뜨개 꽃다발과 모루 오브제를 모바일에서 간결하게 고를 수 있는 홈.</p>
          <div className="hero-actions">
            <Link className="button" to="/products">
              상품 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="surface-card section-rhythm-card">
        <div className="section-head">
          <div>
            <p className="section-kicker">Browse</p>
            <h2 className="section-subtitle">카테고리 바로가기</h2>
            <p className="section-copy section-copy-compact">가장 많이 찾는 분류부터 바로 진입할 수 있게 정리했습니다.</p>
          </div>
          <Link className="button-text" to="/products">
            전체 보기
          </Link>
        </div>

        {loading ? (
          <div className="home-status-card" role="status" aria-live="polite">
            <p className="feedback-copy">카테고리를 준비하고 있습니다.</p>
          </div>
        ) : null}
        {!loading && !error && categories.length === 0 ? (
          <div className="home-status-card">
            <p className="feedback-copy">표시할 카테고리가 아직 없습니다.</p>
          </div>
        ) : null}
        {!loading && !error && categories.length > 0 ? (
          <div className="category-row">
            {categories.map((category) => (
              <Link key={category.slug} className="category-chip" to={`/products?categorySlug=${category.slug}`}>
                {category.name}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="promo-card section-rhythm-card">
        <p className="section-kicker">Signature</p>
        <h2 className="section-subtitle">선물용 패키지와 시즌 컬렉션을 한눈에</h2>
        <p className="section-copy">
          가격대와 카테고리 중심으로 정보 구조를 정리해 모바일에서도 빠르게 비교하고 상세 페이지로 자연스럽게 이어지도록
          구성했습니다.
        </p>
        <div className="promo-points" aria-label="추천 탐색 경로">
          <span>신상품 확인</span>
          <span>카테고리 탐색</span>
          <span>상세 페이지 이동</span>
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Latest Picks</p>
            <h2 className="section-subtitle">최근 등록된 상품</h2>
            <p className="section-copy section-copy-compact">홈 화면에서 바로 비교할 수 있도록 최근 등록 상품 4개만 선별해 노출합니다.</p>
          </div>
          <Link className="button-text" to="/products?sort=latest">
            신상품 보기
          </Link>
        </div>

        {loading ? (
          <div className="home-status-card" role="status" aria-live="polite">
            <p className="feedback-copy">상품을 불러오는 중입니다.</p>
          </div>
        ) : null}
        {error ? (
          <div className="home-status-card home-status-card-error" role="alert">
            <p className="feedback-copy is-error">{error}</p>
            <button className="button button-ghost" type="button" onClick={() => setReloadKey((value) => value + 1)}>
              다시 불러오기
            </button>
          </div>
        ) : null}
        {!loading && !error && featuredProducts.length === 0 ? (
          <div className="home-status-card">
            <p className="feedback-copy">추천할 최신 상품이 아직 없습니다.</p>
          </div>
        ) : null}

        {!loading && !error && featuredProducts.length > 0 ? (
          <div className="feature-grid">
            {featuredProducts.map((product) => (
              <Link className="feature-card" key={product.id} to={`/products/${product.id}`}>
                <div className="feature-card-media">
                  <ProductArtwork src={product.thumbnailImageUrl} name={product.name} category={product.categoryName} />
                </div>
                <div className="feature-card-body">
                  <p className="section-kicker">{product.categoryName}</p>
                  <h3>{product.name}</h3>
                  <p className="feature-card-copy">{product.shortDescription ?? '정성스럽게 제작한 수작업 상품입니다.'}</p>
                  <div className="feature-card-meta">
                    <strong>{formatCurrency(product.basePrice)}</strong>
                    <span className={`status-pill ${product.isSoldOut ? 'is-muted' : ''}`}>
                      {product.isSoldOut ? '품절' : '판매 중'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <div className="home-admin-entry">
        <Link className="home-admin-link" to="/admin/login">
          관리자 로그인
        </Link>
      </div>
    </main>
  );
}

function NotFoundPage() {
  return <Navigate to="/" replace />;
}

function AppFrame() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className={`app-shell ${isAdminRoute ? 'is-admin' : 'is-store'}`}>
      {isAdminRoute ? null : <MobileHeader />}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/orders" element={<OrderLookupPage />} />
        <Route path="/products" element={<CatalogPage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />
        <Route path="/products/:productId/order" element={<OrderPage />} />
        <Route path="/custom-checkout/:token" element={<CustomCheckoutPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="categories" replace />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="custom-orders" element={<AdminCustomOrdersPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<AdminProductEditorPage />} />
          <Route path="products/:productId" element={<AdminProductEditorPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {isAdminRoute ? null : <BottomNav />}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppFrame />
    </BrowserRouter>
  );
}
