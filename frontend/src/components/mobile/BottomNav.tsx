import { Link, useLocation } from 'react-router-dom';

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M7 10.5V19h10v-8.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

const navItems = [
  { to: '/', label: '홈', Icon: HomeIcon },
  { to: '/products', label: '상품', Icon: SearchIcon },
];

export function BottomNav() {
  const location = useLocation();

  if (location.pathname.startsWith('/products/') || location.pathname === '/admin/login') {
    return null;
  }

  return (
    <nav className="m-bottom-nav" aria-label="하단 내비게이션">
      <div className="m-bottom-nav-inner">
        {navItems.map(({ to, label, Icon }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(`${to}/`);

          return (
            <Link
              key={to}
              to={to}
              className={`m-bottom-nav-item ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="m-bottom-nav-icon">
                <Icon />
              </span>
              <span className="m-bottom-nav-label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
