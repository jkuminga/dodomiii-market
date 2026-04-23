import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import logoMain from '../../assets/images/logo_main3.jpg';
import { apiClient, CategoryTreeNode } from '../../lib/api';
import { useCart } from '../../lib/cart';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

const primaryNavItems = [
  { to: '/', label: '홈' },
  { to: '/products', label: '카테고리' },
  { to: '/notices', label: '공지사항' },
  { to: '/inquery', label: '문의' },
];

type DesktopHeaderProps = {
  onOpenSearch: () => void;
};

export function DesktopHeader({ onOpenSearch }: DesktopHeaderProps) {
  const location = useLocation();
  const { itemCount } = useCart();
  const [categoryRoots, setCategoryRoots] = useState<CategoryTreeNode[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await apiClient.getCategories();
        if (!cancelled) {
          setCategoryRoots(result.items);
        }
      } catch {
        if (!cancelled) {
          setCategoryRoots([]);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="d-header">
      <div className="d-header-inner">
        <Link className="d-logo" to="/">
          <span className="d-logo-image-wrap" aria-hidden="true">
            <img className="d-logo-image" src={logoMain} alt="" />
          </span>
          <span className="d-logo-copy">
            <strong>DODOMIII</strong>
            <small>Handmade market</small>
          </span>
        </Link>

        <nav className="d-nav" aria-label="데스크탑 주요 메뉴">
          {primaryNavItems.map((item) => {
            const active =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

            if (item.to === '/products') {
              return (
                <div key={item.to} className={`d-nav-item has-dropdown ${active ? 'is-active' : ''}`}>
                  <Link className={`d-nav-link ${active ? 'is-active' : ''}`} to={item.to} aria-current={active ? 'page' : undefined}>
                    {item.label}
                  </Link>

                  <div className="d-category-dropdown" role="menu" aria-label="카테고리 전체 목록">
                    {categoryRoots.length === 0 ? (
                      <p className="d-category-empty">표시할 카테고리가 없습니다.</p>
                    ) : (
                      <ul className="d-category-root-list">
                        {categoryRoots.map((root) => (
                          <li key={root.slug} className="d-category-root-item">
                            <Link className="d-category-root-link" to={`/products?categorySlug=${root.slug}`}>
                              {root.name}
                            </Link>
                            {root.children.length > 0 ? (
                              <ul className="d-category-child-list">
                                {root.children.map((child) => (
                                  <li key={child.slug}>
                                    <Link className="d-category-child-link" to={`/products?categorySlug=${child.slug}`}>
                                      {child.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <Link key={item.to} className={`d-nav-link ${active ? 'is-active' : ''}`} to={item.to} aria-current={active ? 'page' : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="d-header-actions">
          <button className="d-header-search-link" type="button" onClick={onOpenSearch} aria-label="검색 열기">
            <SearchIcon />
          </button>
          <Link className="d-header-cart-link" to="/cart" aria-label="장바구니로 이동">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 9V7a5 5 0 0 1 10 0v2" />
              <path d="M5 9h14l-1 10H6L5 9Z" />
            </svg>
            {itemCount > 0 ? <span className="header-cart-badge">{itemCount}</span> : null}
          </Link>
          <Link className="button button-secondary d-header-button" to="/orders">
            주문조회
          </Link>
        </div>
      </div>
    </header>
  );
}
