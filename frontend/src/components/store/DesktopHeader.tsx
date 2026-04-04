import { Link, useLocation } from 'react-router-dom';

import logoMain from '../../assets/images/logo_main3.jpg';

const primaryNavItems = [
  { to: '/', label: '홈' },
  { to: '/products', label: '상품' },
  { to: '/orders', label: '주문조회' },
  { to: '/notices', label: '공지사항' },
  { to: '/qna', label: 'QnA' },
];

export function DesktopHeader() {
  const location = useLocation();

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

            return (
              <Link key={item.to} className={`d-nav-link ${active ? 'is-active' : ''}`} to={item.to} aria-current={active ? 'page' : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="d-header-actions">
          <Link className="button button-secondary d-header-button" to="/products?sort=latest">
            신상품 보기
          </Link>
        </div>
      </div>
    </header>
  );
}
