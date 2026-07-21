import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import termsOfUsePdf from './assets/documents/terms_of_use.pdf';
import logoMain from './assets/images/Hero_image.png';
import { LoadingScreen } from './components/common/LoadingScreen';
import { BottomNav } from './components/mobile/BottomNav';
import { MobileHeader } from './components/mobile/MobileHeader';
import { AnimatedCursor } from './components/store/AnimatedCursor';
import { DesktopHeader } from './components/store/DesktopHeader';
import { ProductArtwork } from './components/store/ProductArtwork';
import {
  apiClient,
  CategoryTreeNode,
  ProductListItem,
  StoreHomeHero,
  StoreHomePopup,
  StoreWebFontFamily,
  StoreWebFontWeightPreset,
  UserWebFontSize,
} from './lib/api';
import {
  DEFAULT_STORE_WEB_FONT_FAMILY,
  DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET,
  STORE_WEB_FONT_ATTRIBUTE,
  STORE_WEB_FONT_WEIGHT_ATTRIBUTE,
} from './lib/storeFonts';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminAccountFormPage } from './pages/admin/AdminAccountFormPage';
import { AdminAccountsPage } from './pages/admin/AdminAccountsPage';
import { AdminCustomOrdersPage } from './pages/admin/AdminCustomOrdersPage';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { AdminHomePopupEditorPage } from './pages/admin/AdminHomePopupEditorPage';
import { AdminHomePopupsPage } from './pages/admin/AdminHomePopupsPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminNoticeEditorPage } from './pages/admin/AdminNoticeEditorPage';
import { AdminNoticesPage } from './pages/admin/AdminNoticesPage';
import { AdminOrderDetailPage } from './pages/admin/AdminOrderDetailPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminProductEditorPage } from './pages/admin/AdminProductEditorPage';
import { AdminProductsPage } from './pages/admin/AdminProductsPage';
import { CatalogPage } from './pages/store/CatalogPage';
import { CartPage } from './pages/store/CartPage';
import { CartOrderPage } from './pages/store/CartOrderPage';
import { CustomCheckoutPage } from './pages/store/CustomCheckoutPage';
import { CustomOrderProductPage } from './pages/store/CustomOrderProductPage';
import { DepositRequestCompletePage } from './pages/store/DepositRequestCompletePage';
import { NoticeDetailPage } from './pages/store/NoticeDetailPage';
import { NoticeListPage } from './pages/store/NoticeListPage';
import { OrderLookupPage } from './pages/store/OrderLookupPage';
import { OrderPaymentPage } from './pages/store/OrderPaymentPage';
import { OrderPage } from './pages/store/OrderPage';
import { ProductDetailPage } from './pages/store/ProductDetailPage';
import { InqueryPage } from './pages/store/InqueryPage';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
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
  const location = useLocation();
  const HOME_POPUP_HIDE_UNTIL_PREFIX = 'dodomi.home.popup.hideUntil.';
  const [landingCategories, setLandingCategories] = useState<LandingCategory[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductListItem[]>([]);
  const [homePopups, setHomePopups] = useState<StoreHomePopup[]>([]);
  const [homeHero, setHomeHero] = useState<StoreHomeHero | null>(null);
  const [showHomePopup, setShowHomePopup] = useState(false);
  const [selectedHomePopupIndex, setSelectedHomePopupIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [heroReveal, setHeroReveal] = useState(false);
  const forceLoading = new URLSearchParams(location.search).get('debugLoading') === '1';

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const [categoriesResult, productsResult, homeHeroResult] = await Promise.all([
          apiClient.getCategories(),
          apiClient.getProducts({ sort: 'latest', size: 4 }),
          apiClient.getHomeHero(),
        ]);

        if (cancelled) {
          return;
        }

        setLandingCategories(collectLandingCategories(categoriesResult.items));
        setFeaturedProducts(productsResult.items.slice(0, 4));
        setHomeHero(homeHeroResult);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '홈 화면을 불러오는 중 오류가 발생했습니다.');
          setHomeHero(null);
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
        const homePopupResult = await apiClient.getHomePopups();
        if (cancelled) {
          return;
        }

        const visiblePopups = homePopupResult.items.filter((popup) => {
          if (!popup.isActive) {
            return false;
          }

          const storageKey = `${HOME_POPUP_HIDE_UNTIL_PREFIX}${popup.id}`;
          const hideUntil = Number(window.localStorage.getItem(storageKey) ?? '0');
          return !Number.isFinite(hideUntil) || hideUntil <= Date.now();
        });

        setHomePopups(visiblePopups);
        setSelectedHomePopupIndex(0);
        if (visiblePopups.length === 0) {
          setShowHomePopup(false);
          return;
        }

        setShowHomePopup(true);
      } catch {
        if (!cancelled) {
          setHomePopups([]);
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
    if (homePopups.length === 0) {
      return;
    }

    const hideUntil = Date.now() + 24 * 60 * 60 * 1000;
    homePopups.forEach((popup) => {
      const storageKey = `${HOME_POPUP_HIDE_UNTIL_PREFIX}${popup.id}`;
      window.localStorage.setItem(storageKey, String(hideUntil));
    });
    setShowHomePopup(false);
  };

  const homePopupCount = homePopups.length;
  const selectedHomePopupIndexSafe = homePopupCount === 0 ? 0 : Math.min(selectedHomePopupIndex, homePopupCount - 1);
  const selectedHomePopup = homePopups[selectedHomePopupIndexSafe] ?? null;
  const hasMultipleHomePopups = homePopupCount > 1;

  const showPreviousHomePopup = () => {
    if (homePopupCount <= 1) {
      return;
    }

    setSelectedHomePopupIndex((current) => (current - 1 + homePopupCount) % homePopupCount);
  };

  const showNextHomePopup = () => {
    if (homePopupCount <= 1) {
      return;
    }

    setSelectedHomePopupIndex((current) => (current + 1) % homePopupCount);
  };

  useEffect(() => {
    if (homePopupCount === 0) {
      setSelectedHomePopupIndex(0);
      return;
    }

    if (selectedHomePopupIndex >= homePopupCount) {
      setSelectedHomePopupIndex(homePopupCount - 1);
    }
  }, [homePopupCount, selectedHomePopupIndex]);

  useEffect(() => {
    if (!showHomePopup) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowHomePopup(false);
        return;
      }

      if (homePopupCount <= 1) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelectedHomePopupIndex((current) => (current - 1 + homePopupCount) % homePopupCount);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelectedHomePopupIndex((current) => (current + 1) % homePopupCount);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [homePopupCount, showHomePopup]);

  useEffect(() => {
    if (loading) {
      setHeroReveal(false);
      return;
    }

    setHeroReveal(true);
  }, [loading]);

  const homePopupLayer =
    showHomePopup && selectedHomePopup ? (
      <div
        className="home-popup-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={`홈 팝업 ${selectedHomePopupIndexSafe + 1} / ${homePopupCount}`}
        onClick={() => setShowHomePopup(false)}
      >
        <div className="home-popup-card" onClick={(event) => event.stopPropagation()}>
          <div className="home-popup-body">
            <div className="home-popup-viewport">
              <div
                className="home-popup-track"
                style={{ transform: `translateX(-${selectedHomePopupIndexSafe * 100}%)` }}
              >
                {homePopups.map((popup, index) => {
                  const image = (
                    <img className="home-popup-image" src={popup.imageUrl} alt={popup.title || '홈 팝업 이미지'} />
                  );

                  return (
                    <div
                      className="home-popup-slide"
                      key={popup.id}
                      aria-hidden={index !== selectedHomePopupIndexSafe}
                    >
                      {popup.linkUrl ? (
                        <a
                          className="home-popup-image-link"
                          href={popup.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          tabIndex={index === selectedHomePopupIndexSafe ? 0 : -1}
                        >
                          {image}
                        </a>
                      ) : (
                        image
                      )}
                    </div>
                  );
                })}
              </div>

              {hasMultipleHomePopups ? (
                <>
                  <button
                    className="home-popup-nav is-prev"
                    type="button"
                    onClick={showPreviousHomePopup}
                    aria-label="이전 팝업"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <button
                    className="home-popup-nav is-next"
                    type="button"
                    onClick={showNextHomePopup}
                    aria-label="다음 팝업"
                  >
                    <ChevronRightIcon />
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {hasMultipleHomePopups ? (
            <div className="home-popup-controls" aria-label="팝업 순서">
              <div className="home-popup-indicators">
                {homePopups.map((popup, index) => (
                  <button
                    className={`home-popup-dot${index === selectedHomePopupIndexSafe ? ' is-active' : ''}`}
                    key={popup.id}
                    type="button"
                    onClick={() => setSelectedHomePopupIndex(index)}
                    aria-label={`${index + 1}번째 팝업 보기`}
                    aria-current={index === selectedHomePopupIndexSafe ? 'true' : undefined}
                  />
                ))}
              </div>
              <span className="home-popup-counter" aria-hidden="true">
                {selectedHomePopupIndexSafe + 1} / {homePopupCount}
              </span>
            </div>
          ) : null}

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

  if (loading || forceLoading) {
    return (
      <main className="m-page home-page">
        <LoadingScreen
          title="도도미 마켓 준비 중"
          message={forceLoading ? '디버그 로딩 프리뷰 모드입니다.' : '잠시만 기다려 주세요.'}
        />
        {forceLoading ? null : homePopupLayer}
      </main>
    );
  }

  return (
    <main className="m-page home-page">
      {homePopupLayer}

      <section className={`surface-hero hero-stage hero-stage-landing ${heroReveal ? 'is-hero-reveal' : ''}`}>
        <div className="hero-landing-media" aria-hidden="true">
          <img className="hero-landing-bg" src={homeHero?.imageUrl || logoMain} alt="" />
          <div className="hero-landing-gradient" />
          <div className="hero-landing-grain" />
          {/* <div className="hero-landing-stamp">
            <img className="hero-logo-image" src={logoMain} alt="" />
          </div> */}
        </div>

        <div className="hero-copy hero-copy-polished hero-copy-landing">
          {/* <p className="hero-badge">DODOMiiii MARKET</p> */}
          {/* <h1 className="section-title hero-title">DODOMiiii MARKET</h1> */}
          {/* <p className="section-copy hero-summary">
            시들지 않는 마음을 선물하세요
          </p> */}
          <div className="hero-actions">
            {/* s */}
            {/* <Link className="button-text" to="/notices">
              공지 확인
            </Link> */}
          </div>
        </div>
      </section>


      <div className="landing-category-block">
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
      </div>

      <footer className="landing-footer landing-footer-desktop" aria-labelledby="landing-footer-title">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <p className="landing-footer-kicker">DODOMiiii MARKET</p>
            <h2 id="landing-footer-title">도도미마켓</h2>
            <p>행복을 나누는 핸드메이드 마켓☘️</p>
          </div>

          <hr className="landing-footer-divider" />

          <div className="landing-footer-grid">
            <section className="landing-footer-section" aria-label="고객센터">
              <h3>CS</h3>
              <dl className="landing-footer-list">
                <div>
                  <dt>연락처</dt>
                  <dd>
                    <a href="tel:01085116605">010-8511-6605</a>
                  </dd>
                </div>
                <div>
                  <dt>이메일</dt>
                  <dd>
                    <a href="mailto:dodomiiiimarket@gmail.com">dodomiiiimarket@gmail.com</a>
                    <a href="mailto:dhj0406@naver.com">dhj0406@naver.com</a>
                  </dd>
                </div>
              </dl>
            </section>

            <section className="landing-footer-section" aria-label="회사 정보">
              <h3>COMPANY</h3>
              <dl className="landing-footer-list">
                <div>
                  <dt>상호명</dt>
                  <dd>도도미마켓</dd>
                </div>
                <div>
                  <dt>대표자</dt>
                  <dd>도현정</dd>
                </div>
                <div>
                  <dt>사업장주소</dt>
                  <dd>울산광역시 남구 은월로2번길 23 (44644)</dd>
                </div>
                <div>
                  <dt>사업자등록번호</dt>
                  <dd>139-30-35084</dd>
                </div>
                <div>
                  <dt>호스팅서비스제공자</dt>
                  <dd>Vercel Inc.</dd>
                </div>
              </dl>
            </section>

            <section className="landing-footer-section" aria-label="사업장 및 개인정보 안내">
              <h3>INFO</h3>
              <nav className="landing-footer-policy-links" aria-label="도도미마켓 정책 문서">
                <Link to="/legal/terms">이용약관</Link>
                <Link to="/legal/privacy">개인정보처리방침</Link>
              </nav>
            </section>
            <section className='landing-footer-section'>
              <dl className='landing-footer-list' style={{marginLeft :"10px", color : "grey"}}>
                Copyright 2026. 도도미마켓. All rights reserved.
              </dl>
            </section>
          </div>
        </div>
      </footer>

      <footer className="landing-footer landing-footer-mobile" aria-label="도도미마켓 하단 정보">
        <div className="landing-footer-inner">
          <div className="landing-footer-mobile-contact">
            <p className="landing-footer-mobile-name">도도미 마켓</p>
            <p className="landing-footer-mobile-name-en">DODOMiiii MARKET</p>
            <a href="mailto:dodomiiiimarket@gmail.com">dodomiiiimarket@gmail.com</a>
            <a href="tel:01085116605">010-8511-6605</a>
          </div>

          <details className="landing-footer-mobile-details">
            <summary>
              <span>도도미마켓 정보</span>
              <span className="landing-footer-mobile-chevron" aria-hidden="true" />
            </summary>

            <div className="landing-footer-mobile-panel">
              <dl className="landing-footer-list">
                <div>
                  <dt>상호명</dt>
                  <dd>도도미마켓</dd>
                </div>
                <div>
                  <dt>대표자</dt>
                  <dd>도현정</dd>
                </div>
                <div>
                  <dt>사업자등록번호</dt>
                  <dd>139-30-35084</dd>
                </div>
                <div>
                  <dt>통신판매업신고번호</dt>
                  <dd>확인 중</dd>
                </div>
                <div>
                  <dt>호스팅서비스제공자</dt>
                  <dd>확인 필요</dd>
                </div>
                <div>
                  <dt>사업장주소</dt>
                  <dd>울산광역시 남구 은월로2번길 23 (44644)</dd>
                </div>
                <div>
                  <dt>개인정보처리방침</dt>
                  <dd>
                    주문 시 제공해주시는 개인정보는 배송 및 고객응대를 위해서만 사용되며, 관련 법령에 따라 안전하게
                    사용됩니다.
                  </dd>
                </div>
              </dl>
            </div>
          </details>

          <nav className="landing-footer-mobile-links" aria-label="도도미마켓 정책 문서">
            <Link to="/legal/terms">이용약관</Link>
            <Link to="/legal/privacy">개인정보취급방침</Link>
          </nav>
        </div>
      </footer>

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

      {/* <section className="home-section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Latest Picks</p>
            <h2 className="section-subtitle">최근 등록된 상품</h2>
          </div>
          <Link className="button-text" to="/products?sort=latest">
            신상품 보기
          </Link>
        </div>

        {error ? (
          <div className="home-status-card home-status-card-error" role="alert">
            <p className="feedback-copy is-error">{error}</p>
            <button className="button button-ghost" type="button" onClick={() => setReloadKey((value) => value + 1)}>
              다시 불러오기
            </button>
          </div>
        ) : null}
        {!error && featuredProducts.length === 0 ? (
          <div className="home-status-card">
            <p className="feedback-copy">추천할 최신 상품이 아직 없습니다.</p>
          </div>
        ) : null}

        {!error && featuredProducts.length > 0 ? (
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
      </section> */}

      {/* <div className="home-admin-entry">
        <Link className="home-admin-link" to="/admin/login">
          관리자 로그인
        </Link>
      </div> */}
    </main>
  );
}

type SearchOverlayProps = {
  isOpen: boolean;
  keyword: string;
  onKeywordChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (keyword: string) => void;
};

function SearchOverlay({ isOpen, keyword, onKeywordChange, onClose, onSubmit }: SearchOverlayProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const CLOSE_ANIMATION_MS = 220;

  useEffect(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (isOpen) {
      setIsRendered(true);
      window.requestAnimationFrame(() => {
        setIsClosing(false);
      });
      return;
    }

    if (isRendered) {
      setIsClosing(true);
      closeTimeoutRef.current = window.setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
        closeTimeoutRef.current = null;
      }, CLOSE_ANIMATION_MS);
    }

    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered) {
      return;
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isRendered]);

  useEffect(() => {
    if (!isRendered) {
      document.body.style.overflow = '';
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isRendered, onClose]);

  if (!isRendered) {
    return null;
  }

  return (
    <div className={`home-search-overlay ${isClosing ? 'is-closing' : 'is-open'}`} role="dialog" aria-modal="true" aria-label="상품 검색">
      <button className="home-search-backdrop" type="button" aria-label="검색 닫기" onClick={onClose} />

      <div className="home-search-panel">
        <div className="home-search-panel-head">
          <p className="home-search-kicker">Search</p>
          <button className="m-icon-btn home-search-close" type="button" onClick={onClose} aria-label="검색 닫기">
            <CloseIcon />
          </button>
        </div>

        <form
          className="home-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(keyword.trim());
          }}
        >
          <label className="home-search-label" htmlFor="home-search-input">
            상품명으로 검색
          </label>
          <div className="home-search-bar">
            <span className="home-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              id="home-search-input"
              ref={searchInputRef}
              className="home-search-input"
              type="search"
              inputMode="search"
              placeholder="예: 튤립, 꽃다발, 선물"
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
            />
            <button className="button home-search-submit" type="submit">
              검색
            </button>
          </div>
          <p className="home-search-helper">상품명, 카테고리명, 선물용 키워드로 바로 찾아볼 수 있습니다.</p>
        </form>
      </div>
    </div>
  );
}

const LEGAL_DOCUMENTS = {
  terms: {
    title: '이용약관',
    description: '도도미마켓 이용약관 문서입니다.',
    pdfUrl: termsOfUsePdf,
  },
  privacy: {
    title: '개인정보취급방침',
    description: '도도미마켓 개인정보취급방침 문서를 준비 중입니다.',
    pdfUrl: null,
  },
  guide: {
    title: '이용안내',
    description: '도도미마켓 이용안내 문서를 준비 중입니다.',
    pdfUrl: null,
  },
} as const;

type LegalDocumentType = keyof typeof LEGAL_DOCUMENTS;

function isLegalDocumentType(value: string | undefined): value is LegalDocumentType {
  return value === 'terms' || value === 'privacy' || value === 'guide';
}

function LegalDocumentPage() {
  const { documentType } = useParams();

  if (!isLegalDocumentType(documentType)) {
    return <Navigate to="/legal/terms" replace />;
  }

  const document = LEGAL_DOCUMENTS[documentType];

  return (
    <main className="m-page legal-document-page">
      <section className="surface-card legal-document-shell" aria-labelledby="legal-document-title">
        <div className="legal-document-head">
          <p className="section-kicker">DODOMII MARKET</p>
          <h1 id="legal-document-title" className="section-title legal-document-title">
            {document.title}
          </h1>
        </div>

        {document.pdfUrl ? (
          <div className="legal-document-viewer">
            <iframe src={document.pdfUrl} title={document.title} />
            <p>
              PDF가 보이지 않으면{' '}
              <a href={document.pdfUrl} target="_blank" rel="noreferrer">
                새 창에서 열기
              </a>
              를 눌러 확인해주세요.
            </p>
          </div>
        ) : (
          <article className="legal-document-body">
            <p>{document.description}</p>
            <p>추후 PDF 파일을 연결해 이 영역에 문서 본문을 렌더링할 예정입니다.</p>
          </article>
        )}
      </section>
    </main>
  );
}

function NotFoundPage() {
  return <Navigate to="/" replace />;
}

const STORE_FONT_SIZE_ATTRIBUTE: Record<UserWebFontSize, string> = {
  VERY_SMALL: 'very-small',
  SMALL: 'small',
  NORMAL: 'normal',
  LARGE: 'large',
  VERY_LARGE: 'very-large',
};

const CANONICAL_ORIGIN = 'https://www.dodomiiii-market.store';

function isCanonicalStorePath(pathname: string): boolean {
  return (
    pathname === '/'
    || pathname === '/products'
    || pathname === '/products/custom-order'
    || /^\/products\/[^/]+$/.test(pathname)
    || pathname === '/notices'
    || /^\/notices\/[^/]+$/.test(pathname)
    || pathname === '/legal/terms'
    || pathname === '/legal/privacy'
  );
}

function CanonicalUrl() {
  const { pathname } = useLocation();

  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!isCanonicalStorePath(pathname)) {
      existing?.remove();
      return;
    }

    const canonical = existing ?? document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = new URL(pathname, CANONICAL_ORIGIN).toString();

    if (!existing) {
      document.head.append(canonical);
    }
  }, [pathname]);

  return null;
}

function AppFrame() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [storeFontSize, setStoreFontSize] = useState<UserWebFontSize>('NORMAL');
  const [storeFontFamily, setStoreFontFamily] = useState<StoreWebFontFamily>(DEFAULT_STORE_WEB_FONT_FAMILY);
  const [storeFontWeightPreset, setStoreFontWeightPreset] = useState<StoreWebFontWeightPreset>(DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET);
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

  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let cancelled = false;

    if (isAdminRoute) {
      setStoreFontSize('NORMAL');
      setStoreFontFamily(DEFAULT_STORE_WEB_FONT_FAMILY);
      setStoreFontWeightPreset(DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET);
      return;
    }

    const loadStorefrontSettings = async () => {
      try {
        const settings = await apiClient.getStorefrontSettings();
        if (!cancelled) {
          setStoreFontSize(settings.userWebFontSize);
          setStoreFontFamily(settings.userWebFontFamily);
          setStoreFontWeightPreset(settings.userWebFontWeightPreset);
        }
      } catch {
        if (!cancelled) {
          setStoreFontSize('NORMAL');
          setStoreFontFamily(DEFAULT_STORE_WEB_FONT_FAMILY);
          setStoreFontWeightPreset(DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET);
        }
      }
    };

    void loadStorefrontSettings();

    return () => {
      cancelled = true;
    };
  }, [isAdminRoute]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    if (isAdminRoute) {
      delete document.documentElement.dataset.storeFontSize;
      delete document.documentElement.dataset.storeFontFamily;
      delete document.documentElement.dataset.storeFontWeight;
      return;
    }

    document.documentElement.dataset.storeFontSize = STORE_FONT_SIZE_ATTRIBUTE[storeFontSize];
    document.documentElement.dataset.storeFontFamily = STORE_WEB_FONT_ATTRIBUTE[storeFontFamily];
    document.documentElement.dataset.storeFontWeight = STORE_WEB_FONT_WEIGHT_ATTRIBUTE[storeFontWeightPreset];

    return () => {
      delete document.documentElement.dataset.storeFontSize;
      delete document.documentElement.dataset.storeFontFamily;
      delete document.documentElement.dataset.storeFontWeight;
    };
  }, [isAdminRoute, storeFontFamily, storeFontSize, storeFontWeightPreset]);

  const openSearch = () => {
    setSearchKeyword('');
    setSearchOpen(true);
  };

  const closeSearch = () => {
    setSearchOpen(false);
  };

  const submitSearch = (keyword: string) => {
    if (!keyword) {
      return;
    }

    setSearchOpen(false);
    navigate(`/products?q=${encodeURIComponent(keyword)}`);
  };

  const isDesktopStoreRoute = !isAdminRoute && isDesktopViewport;
  const shellClassName = `app-shell ${isAdminRoute ? 'is-admin' : 'is-store'}${isDesktopStoreRoute ? ' is-store-desktop' : ''}`;

  return (
    <div className={shellClassName}>
      <CanonicalUrl />
      {isAdminRoute
        ? null
        : isDesktopStoreRoute
          ? <DesktopHeader onOpenSearch={openSearch} />
          : <MobileHeader />}

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notices" element={<NoticeListPage />} />
        <Route path="/notices/:noticeId" element={<NoticeDetailPage />} />
        <Route path="/inquery" element={<InqueryPage />} />
        <Route path="/legal/:documentType" element={<LegalDocumentPage />} />
        <Route path="/orders" element={<OrderLookupPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/cart/order" element={<CartOrderPage />} />
        <Route path="/orders/:orderNumber/payment" element={<OrderPaymentPage />} />
        <Route path="/orders/:orderNumber/deposit-request-complete" element={<DepositRequestCompletePage />} />
        <Route path="/products" element={<CatalogPage />} />
        <Route path="/products/custom-order" element={<CustomOrderProductPage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />
        <Route path="/products/:productId/order" element={<OrderPage />} />
        <Route path="/custom-checkout/:token" element={<CustomCheckoutPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="categories" replace />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="accounts" element={<AdminAccountsPage />} />
          <Route path="accounts/new" element={<AdminAccountFormPage />} />
          <Route path="accounts/:adminId/edit" element={<AdminAccountFormPage />} />
          <Route path="custom-orders" element={<AdminCustomOrdersPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<AdminProductEditorPage />} />
          <Route path="products/:productId" element={<AdminProductEditorPage />} />
          <Route path="notices" element={<AdminNoticesPage />} />
          <Route path="notices/new" element={<AdminNoticeEditorPage />} />
          <Route path="notices/:noticeId" element={<AdminNoticeEditorPage />} />
          <Route path="home" element={<AdminHomePage />} />
          <Route path="home-popup" element={<Navigate to="/admin/home-popups" replace />} />
          <Route path="home-popups" element={<AdminHomePopupsPage />} />
          <Route path="home-popups/new" element={<AdminHomePopupEditorPage />} />
          <Route path="home-popups/:popupId" element={<AdminHomePopupEditorPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {isAdminRoute || isDesktopStoreRoute ? null : <BottomNav onOpenSearch={openSearch} />}
      <SearchOverlay
        isOpen={searchOpen}
        keyword={searchKeyword}
        onKeywordChange={setSearchKeyword}
        onClose={closeSearch}
        onSubmit={submitSearch}
      />
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
