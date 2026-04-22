import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import logoMain from '../../assets/images/logo_main3.jpg';
import { apiClient, CategoryTreeNode } from '../../lib/api';
import { useCart } from '../../lib/cart';

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

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
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
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [roots, setRoots] = useState<CategoryTreeNode[]>([]);
  const [expandedRootSlugs, setExpandedRootSlugs] = useState<Set<string>>(new Set());

  const detailMatch = location.pathname.match(/^\/products\/([^/]+)$/);
  const orderMatch = location.pathname.match(/^\/products\/([^/]+)\/order$/);
  const isDetailPage = !!detailMatch;
  const isOrderPage = !!orderMatch;
  const isLoginPage = location.pathname === '/admin/login';
  const showBackButton = isDetailPage || isOrderPage || isLoginPage;

  useEffect(() => {
    setMenuOpen(false);
    setExpandedRootSlugs(new Set());
  }, [location.pathname, location.search]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await apiClient.getCategories();
        if (!cancelled) {
          setRoots(result.items);
        }
      } catch {
        if (!cancelled) {
          setRoots([]);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (isOrderPage) {
      navigate(`/products/${orderMatch[1]}`, { replace: false });
      return;
    }

    navigate(isDetailPage ? '/products' : '/', { replace: false });
  };

  const toggleRoot = (slug: string) => {
    setExpandedRootSlugs((current) => {
      const next = new Set(current);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
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
            <Link className="m-icon-btn m-cart-entry" to="/cart" aria-label="장바구니로 이동">
              <BagIcon />
              {itemCount > 0 ? <span className="header-cart-badge">{itemCount}</span> : null}
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
            {/* <small>메인 화면으로 이동</small> */}
          </Link>

          <section className="m-menu-category-group" aria-label="카테고리 메뉴">
            <div className="m-menu-category-title">카테고리</div>
            {roots.length === 0 ? (
              <p className="m-menu-category-empty">표시할 카테고리가 없습니다.</p>
            ) : (
              <ul className="m-menu-category-root-list">
                {roots.map((root) => {
                  const hasChildren = root.children.length > 0;
                  const expanded = expandedRootSlugs.has(root.slug);

                  return (
                    <li key={root.slug} className="m-menu-category-root-item">
                      <div className="m-menu-category-root-row">
                        <Link className="m-menu-category-link" to={`/products?categorySlug=${root.slug}`}>
                          {root.name}
                        </Link>
                        {hasChildren ? (
                          <button
                            className={`m-menu-category-toggle ${expanded ? 'is-open' : ''}`}
                            type="button"
                            onClick={() => toggleRoot(root.slug)}
                            aria-label={`${root.name} 하위 카테고리 ${expanded ? '닫기' : '열기'}`}
                            aria-expanded={expanded}
                          >
                            <ChevronIcon />
                          </button>
                        ) : null}
                      </div>
                      {hasChildren ? (
                        <ul className={`m-menu-category-child-list ${expanded ? 'is-open' : ''}`}>
                          <div className="m-menu-category-child-list-inner">
                            {root.children.map((child) => (
                              <li key={child.slug}>
                                <Link className="m-menu-category-child-link" to={`/products?categorySlug=${child.slug}`}>
                                  {child.name}
                                </Link>
                              </li>
                            ))}
                          </div>
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <Link className="m-menu-link" to="/notices">
            <span>공지사항</span>
            {/* <small>공지와 운영 소식 확인</small> */}
          </Link>

          <Link className="m-menu-link" to="/qna">
            <span>Q&A</span>
            {/* <small>자주 묻는 질문과 문의</small> */}
          </Link>
        </nav>
      </aside>
    </>
  );
}
