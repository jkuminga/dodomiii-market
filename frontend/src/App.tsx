import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import logoMain from './assets/images/logo_main3.jpg';
import { LoadingScreen } from './components/common/LoadingScreen';
import { BottomNav } from './components/mobile/BottomNav';
import { MobileHeader } from './components/mobile/MobileHeader';
import { AnimatedCursor } from './components/store/AnimatedCursor';
import { DesktopHeader } from './components/store/DesktopHeader';
import { ProductArtwork } from './components/store/ProductArtwork';
import { apiClient, CategoryTreeNode, ProductListItem, StoreHomePopup } from './lib/api';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminCustomOrdersPage } from './pages/admin/AdminCustomOrdersPage';
import { AdminHomePopupPage } from './pages/admin/AdminHomePopupPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminProductEditorPage } from './pages/admin/AdminProductEditorPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { CatalogPage } from './pages/store/CatalogPage';
import { CustomCheckoutPage } from './pages/store/CustomCheckoutPage';
import { DepositRequestCompletePage } from './pages/store/DepositRequestCompletePage';
import { OrderLookupPage } from './pages/store/OrderLookupPage';
import { OrderPaymentPage } from './pages/store/OrderPaymentPage';
import { OrderPage } from './pages/store/OrderPage';
import { ProductDetailPage } from './pages/store/ProductDetailPage';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

type LandingCategory = {
  slug: string;
  name: string;
  imageUrl: string | null;
};

function collectLandingCategories(nodes: CategoryTreeNode[]): LandingCategory[] {
  const result: LandingCategory[] = [];

  const walk = (items: CategoryTreeNode[]) => {
    for (const item of items) {
      if (item.isOnLandingPage) {
        result.push({
          slug: item.slug,
          name: item.name,
          imageUrl: item.imageUrl,
        });
      }

      if (result.length >= 3) {
        return;
      }
      if (item.children.length > 0) {
        walk(item.children);
      }
      if (result.length >= 3) {
        return;
      }
    }
  };

  walk(nodes);

  return result;
}

function HomePage() {
  const HOME_INTRO_SEEN_KEY = 'dodomi.home.intro.seen';
  const HOME_POPUP_HIDE_UNTIL_PREFIX = 'dodomi.home.popup.hideUntil.';
  const [landingCategories, setLandingCategories] = useState<LandingCategory[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductListItem[]>([]);
  const [homePopup, setHomePopup] = useState<StoreHomePopup | null>(null);
  const [showHomePopup, setShowHomePopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [showIntroLoading, setShowIntroLoading] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.sessionStorage.getItem(HOME_INTRO_SEEN_KEY) !== '1';
  });
  const [heroReveal, setHeroReveal] = useState(false);

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

        setLandingCategories(collectLandingCategories(categoriesResult.items));
        setFeaturedProducts(productsResult.items.slice(0, 4));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '홈 화면을 불러오는 중 오류가 발생했습니다.');
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
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;

    const loadPopup = async () => {
      try {
        const homePopupResult = await apiClient.getHomePopup();
        if (cancelled) {
          return;
        }

        setHomePopup(homePopupResult);
        if (!homePopupResult || !homePopupResult.isActive) {
          setShowHomePopup(false);
          return;
        }

        const storageKey = `${HOME_POPUP_HIDE_UNTIL_PREFIX}${homePopupResult.id}`;
        const hideUntil = Number(window.localStorage.getItem(storageKey) ?? '0');
        const shouldShow = !Number.isFinite(hideUntil) || hideUntil <= Date.now();
        setShowHomePopup(shouldShow);
      } catch {
        if (!cancelled) {
          setHomePopup(null);
          setShowHomePopup(false);
        }
      }
    };

    void loadPopup();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const hidePopupForOneDay = () => {
    if (!homePopup) {
      return;
    }

    const storageKey = `${HOME_POPUP_HIDE_UNTIL_PREFIX}${homePopup.id}`;
    const hideUntil = Date.now() + 24 * 60 * 60 * 1000;
    window.localStorage.setItem(storageKey, String(hideUntil));
    setShowHomePopup(false);
  };

  useEffect(() => {
    if (!showIntroLoading || loading) {
      return;
    }

    setShowIntroLoading(false);
    setHeroReveal(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(HOME_INTRO_SEEN_KEY, '1');
    }
  }, [loading, showIntroLoading]);

  const homePopupLayer =
    showHomePopup && homePopup ? (
      <div
        className="home-popup-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="홈 팝업"
        onClick={() => setShowHomePopup(false)}
      >
        <div className="home-popup-card" onClick={(event) => event.stopPropagation()}>
          <div className="home-popup-body">
            {homePopup.linkUrl ? (
              <a className="home-popup-image-link" href={homePopup.linkUrl} target="_blank" rel="noreferrer">
                <img className="home-popup-image" src={homePopup.imageUrl} alt={homePopup.title || '홈 팝업 이미지'} />
              </a>
            ) : (
              <img className="home-popup-image" src={homePopup.imageUrl} alt={homePopup.title || '홈 팝업 이미지'} />
            )}
          </div>

          <div className="home-popup-actions">
            <button className="button button-ghost home-popup-dismiss" type="button" onClick={hidePopupForOneDay}>
              하루 동안 보지 않기
            </button>
            <button className="button home-popup-dismiss" type="button" onClick={() => setShowHomePopup(false)}>
              닫기
            </button>
          </div>
        </div>
      </div>
    ) : null;

  if (showIntroLoading) {
    return (
      <main className="m-page home-page">
        <LoadingScreen title="도도미 마켓 준비 중" message="잠시만 기다려 주세요." />
        {homePopupLayer}
      </main>
    );
  }

  return (
    <main className="m-page home-page">
      {homePopupLayer}

      <section className={`surface-hero hero-stage hero-stage-landing ${heroReveal ? 'is-hero-reveal' : ''}`}>
        <div className="hero-landing-media" aria-hidden="true">
          <img className="hero-landing-bg" src={logoMain} alt="" />
          <div className="hero-landing-gradient" />
          <div className="hero-landing-grain" />
          {/* <div className="hero-landing-stamp">
            <img className="hero-logo-image" src={logoMain} alt="" />
          </div> */}
        </div>

        <div className="hero-copy hero-copy-polished hero-copy-landing">
          <p className="hero-badge">DODOMII MARKET</p>
          <h1 className="section-title hero-title">DODOMIIII MARKET</h1>
          <p className="section-copy hero-summary">
            시들지 않는 마음을 선물하세요
          </p>
          <div className="hero-actions">
            <Link className="button" to="/products">
              상품 보기
            </Link>
            <Link className="button-text" to="/notices">
              공지 확인
            </Link>
          </div>
        </div>
      </section>


      <div className="landing-category-block">
        {loading ? (
          <div className="home-status-card" role="status" aria-live="polite">
            <LoadingScreen mode="inline" title="카테고리 준비 중" message="카테고리를 불러오고 있습니다." />
          </div>
        ) : null}

        {!loading ? (
          <>
            {error ? (
              <p className="feedback-copy is-error" role="alert">
                카테고리 데이터를 불러오지 못해 기본 카드로 표시합니다.
              </p>
            ) : null}
            <div className="landing-category-grid">
              {[0, 1, 2].map((index) => {
                const category = landingCategories[index] ?? null;
                if (!category) {
                  return (
                    <div key={`empty-${index}`} className="landing-category-card is-empty" aria-hidden="true">
                      <div className="landing-category-content">
                        <span>준비 중</span>
                      </div>
                    </div>
                  );
                }

                const cardStyle = category.imageUrl
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(18, 46, 26, 0.18), rgba(12, 34, 20, 0.72)), url(${category.imageUrl})`,
                    }
                  : undefined;

                return (
                  <Link
                    key={category.slug}
                    className={`landing-category-card ${category.imageUrl ? 'has-image' : 'has-theme'}`}
                    to={`/products?categorySlug=${category.slug}`}
                    style={cardStyle}
                  >
                    <div className="landing-category-content">
                      <span>{category.name}</span>
                    </div>
                  </Link>
                );
              })}

              <Link className="landing-category-card landing-category-card-all has-theme" to="/products">
                <div className="landing-category-content">
                  <span>모든 상품 보기</span>
                </div>
              </Link>
            </div>
          </>
        ) : null}
      </div>

      {/* <section className="promo-card section-rhythm-card">
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
      </section> */}

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
            <LoadingScreen mode="inline" title="상품 준비 중" message="최근 등록 상품을 불러오고 있습니다." />
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

function NoticePage() {
  return (
    <main className="m-page page-centered">
      <section className="surface-card">
        <p className="section-kicker">Notice</p>
        <h1 className="section-title">공지사항</h1>
        <p className="section-copy">아직 등록된 공지사항이 없습니다.</p>
      </section>
    </main>
  );
}

function QnaPage() {
  return (
    <main className="m-page page-centered">
      <section className="surface-card">
        <p className="section-kicker">Q&A</p>
        <h1 className="section-title">QnA</h1>
        <p className="section-copy">문의 게시판은 준비 중입니다.</p>
      </section>
    </main>
  );
}

function AppFrame() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 960px)').matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(min-width: 960px)');
    const onChange = (event: MediaQueryListEvent) => setIsDesktopViewport(event.matches);

    setIsDesktopViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);

    return () => {
      mediaQuery.removeEventListener('change', onChange);
    };
  }, []);

  const isDesktopStoreRoute = !isAdminRoute && isDesktopViewport;
  const shellClassName = `app-shell ${isAdminRoute ? 'is-admin' : 'is-store'}${isDesktopStoreRoute ? ' is-store-desktop' : ''}`;

  return (
    <div className={shellClassName}>
      {isAdminRoute ? null : isDesktopStoreRoute ? <DesktopHeader /> : <MobileHeader />}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notices" element={<NoticePage />} />
        <Route path="/qna" element={<QnaPage />} />
        <Route path="/orders" element={<OrderLookupPage />} />
        <Route path="/orders/:orderNumber/payment" element={<OrderPaymentPage />} />
        <Route path="/orders/:orderNumber/deposit-request-complete" element={<DepositRequestCompletePage />} />
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
          <Route path="home-popup" element={<AdminHomePopupPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {isAdminRoute || isDesktopStoreRoute ? null : <BottomNav />}
      <AnimatedCursor enabled={!isAdminRoute} />
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
