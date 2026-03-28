import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import logoMain from '../../assets/images/logo_main3.jpg';

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 9V7a5 5 0 0 1 10 0v2" />
      <path d="M5 9h14l-1 10H6L5 9Z" />
    </svg>
  );
}

export function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isDetailPage = location.pathname.startsWith('/products/');
  const isLoginPage = location.pathname === '/admin/login';
  const showBackButton = isDetailPage || isLoginPage;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleBack = () => {
    navigate(isDetailPage ? '/products' : '/', { replace: false });
  };

  return (
    <>
      <header className="m-header">
        <div className="m-header-inner">
          <div className="m-header-side">
            {showBackButton ? (
              <button className="m-icon-btn" type="button" onClick={handleBack} aria-label="이전 화면으로 이동">
                <ArrowLeftIcon />
              </button>
            ) : (
              <button
                className="m-icon-btn"
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu-panel"
                aria-label="메뉴 열기"
              >
                <MenuIcon />
              </button>
            )}
          </div>

          <Link className="m-logo" to="/">
            <span className="m-logo-image-wrap" aria-hidden="true">
              <img className="m-logo-image" src={logoMain} alt="" />
            </span>
            <span className="m-logo-copy">
              <strong>DODOMIII</strong>
              <small>Handmade market</small>
            </span>
          </Link>

          <div className="m-header-side m-header-actions">
            <Link className="m-icon-btn" to="/products" aria-label="상품 목록으로 이동">
              <BagIcon />
            </Link>
          </div>
        </div>
      </header>

      {menuOpen ? <button className="m-menu-backdrop" type="button" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)} /> : null}

      <aside className={`m-menu-panel ${menuOpen ? 'is-open' : ''}`} id="mobile-menu-panel" aria-hidden={!menuOpen}>
        <div className="m-menu-head">
          <div>
            <p className="section-kicker">DODOMIII MARKET</p>
            <h2>Menu</h2>
          </div>
          <button className="m-icon-btn" type="button" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기">
            <ArrowLeftIcon />
          </button>
        </div>

        <nav className="m-menu-links" aria-label="주요 메뉴">
          <Link className="m-menu-link" to="/">
            <span>홈</span>
            <small>브랜드 소개와 추천 상품</small>
          </Link>
          <Link className="m-menu-link" to="/products">
            <span>전체 상품</span>
            <small>카테고리와 검색 필터로 둘러보기</small>
          </Link>
          <Link className="m-menu-link" to="/products?sort=price_asc">
            <span>가벼운 가격대</span>
            <small>부담 없이 고를 수 있는 아이템</small>
          </Link>
          <Link className="m-menu-link" to="/products?sort=latest">
            <span>신상품</span>
            <small>가장 최근에 등록된 컬렉션</small>
          </Link>
        </nav>
      </aside>
    </>
  );
}
