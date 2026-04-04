import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AdminToastRegion } from '../../components/admin/AdminToastRegion';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { apiClient, AdminSession, setApiAuthErrorHandler } from '../../lib/api';
import { AdminLayoutContext, AdminToast, AdminToastTone } from './adminUtils';

const ADMIN_SIDEBAR_QUERY = '(min-width: 960px)';
const ADMIN_SIDEBAR_STORAGE_KEY = 'dodomi.admin.sidebar.collapsed';

type AdminNavItem = {
  description: string;
  icon: (props: AdminIconProps) => ReactNode;
  label: string;
  to: string;
};

type AdminIconProps = {
  className?: string;
};

const adminPrimaryNavItems: AdminNavItem[] = [
  {
    label: '카테고리 관리',
    description: '분류 구조와 노출 상태 정리',
    to: '/admin/categories',
    icon: CategoryIcon,
  },
  {
    label: '상품 관리',
    description: '상품 등록, 수정, 판매 상태 운영',
    to: '/admin/products',
    icon: ProductIcon,
  },
  {
    label: '홈 팝업',
    description: '메인 진입 팝업 이미지 운영',
    to: '/admin/home-popup',
    icon: HomePopupIcon,
  },
  {
    label: '커스텀 주문',
    description: '개별 링크 생성과 사용 상태 확인',
    to: '/admin/custom-orders',
    icon: CustomOrderIcon,
  },
  {
    label: '주문 관리',
    description: '주문 상태, 입금, 배송 운영',
    to: '/admin/orders',
    icon: OrderIcon,
  },
];

function SidebarIcon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
      {children}
    </svg>
  );
}

function BrandGridIcon(props: AdminIconProps) {
  return (
    <SidebarIcon {...props}>
      <rect x="4.5" y="4.5" width="6" height="6" rx="1.5" />
      <rect x="13.5" y="4.5" width="6" height="6" rx="1.5" />
      <rect x="4.5" y="13.5" width="6" height="6" rx="1.5" />
      <rect x="13.5" y="13.5" width="6" height="6" rx="1.5" />
    </SidebarIcon>
  );
}

function CategoryIcon(props: AdminIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M5 7.5h5l1.6 2H19v7.8A1.7 1.7 0 0 1 17.3 19H6.7A1.7 1.7 0 0 1 5 17.3z" />
      <path d="M5 7a2 2 0 0 1 2-2h2.2c.5 0 .9.2 1.2.6l1 1.2" />
    </SidebarIcon>
  );
}

function ProductIcon(props: AdminIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M12 3.8l7 3.6v9.2l-7 3.6-7-3.6V7.4z" />
      <path d="M12 3.8v16.4" />
      <path d="M5 7.4l7 3.7 7-3.7" />
    </SidebarIcon>
  );
}

function HomePopupIcon(props: AdminIconProps) {
  return (
    <SidebarIcon {...props}>
      <rect x="5" y="4.5" width="14" height="15" rx="2.5" />
      <path d="M8 9.5h8" />
      <path d="M8 13h5.5" />
      <path d="M15.5 6.5h1" />
    </SidebarIcon>
  );
}

function OrderIcon(props: AdminIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M7 5.5h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
      <path d="M8.5 9h7" />
      <path d="M8.5 12h7" />
      <path d="M8.5 15h4.5" />
    </SidebarIcon>
  );
}

function CustomOrderIcon(props: AdminIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M6 7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5v9A2.5 2.5 0 0 1 15.5 19h-7A2.5 2.5 0 0 1 6 16.5z" />
      <path d="M9 9.5h6" />
      <path d="M9 13h4" />
      <path d="M15.5 4.5v4" />
      <path d="M13.5 6.5h4" />
    </SidebarIcon>
  );
}

function LogoutIcon(props: AdminIconProps) {
  return (
    <SidebarIcon {...props}>
      <path d="M10 5.5H7.8A1.8 1.8 0 0 0 6 7.3v9.4a1.8 1.8 0 0 0 1.8 1.8H10" />
      <path d="M13.5 8.5l4 3.5-4 3.5" />
      <path d="M17 12H9.5" />
    </SidebarIcon>
  );
}

function PanelToggleIcon({ collapsed, className }: AdminIconProps & { collapsed: boolean }) {
  return (
    <SidebarIcon className={className}>
      <path d="M5 5.5h14v13H5z" />
      <path d="M9 5.5v13" />
      {collapsed ? <path d="M13 12h4" /> : <path d="M11 12h4" />}
      {collapsed ? <path d="M14.5 10.5l2 1.5-2 1.5" /> : <path d="M13.5 10.5l-2 1.5 2 1.5" />}
    </SidebarIcon>
  );
}

function navClassName({ isActive }: { isActive: boolean }) {
  return `admin-nav-link ${isActive ? 'is-active' : ''}`;
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const timeoutIdsRef = useRef<number[]>([]);
  const sessionExpiryHandledRef = useRef(false);

  const [admin, setAdmin] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) === 'true';
  });
  const [isSidebarMode, setIsSidebarMode] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia(ADMIN_SIDEBAR_QUERY).matches;
  });
  const [toasts, setToasts] = useState<AdminToast[]>([]);

  const refreshSession = async () => {
    const result = await apiClient.me();
    setAdmin(result);
    setSessionError('');
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      try {
        const result = await apiClient.me();

        if (!cancelled) {
          setAdmin(result);
          setSessionError('');
        }
      } catch (caught) {
        if (!cancelled) {
          setSessionError(caught instanceof Error ? caught.message : '세션을 확인할 수 없습니다.');
          setAdmin(null);
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
  }, []);

  useEffect(
    () => () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    },
    [],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(ADMIN_SIDEBAR_QUERY);
    const updateMode = (event: MediaQueryListEvent) => {
      setIsSidebarMode(event.matches);
    };

    setIsSidebarMode(mediaQueryList.matches);

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', updateMode);

      return () => {
        mediaQueryList.removeEventListener('change', updateMode);
      };
    }

    mediaQueryList.addListener(updateMode);

    return () => {
      mediaQueryList.removeListener(updateMode);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const showToast = (message: string, tone: AdminToastTone = 'success') => {
    const toastId = Date.now() + Math.floor(Math.random() * 1000);

    setToasts((current) => [...current, { id: toastId, message, tone }]);

    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
    }, 3400);

    timeoutIdsRef.current.push(timeoutId);
  };

  const dismissToast = (toastId: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => !current);
  };

  useEffect(() => {
    if (!admin) {
      setApiAuthErrorHandler(null);
      return;
    }

    setApiAuthErrorHandler((payload) => {
      if (payload.status !== 401 || sessionExpiryHandledRef.current) {
        return;
      }

      sessionExpiryHandledRef.current = true;
      showToast('세션이 만료되어 로그인 화면으로 이동합니다.', 'error');

      const timeoutId = window.setTimeout(() => {
        navigate('/admin/login', {
          replace: true,
          state: {
            from: location,
            reason: payload.message || '세션이 만료되었습니다.',
          },
        });
      }, 900);

      timeoutIdsRef.current.push(timeoutId);
    });

    return () => {
      setApiAuthErrorHandler(null);
    };
  }, [admin, location, navigate]);

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch {
      // 세션이 이미 만료된 경우에도 로그인 화면으로 보낸다.
    }

    navigate('/admin/login', {
      replace: true,
      state: {
        from: location,
      },
    });
  };

  const outletContext: AdminLayoutContext | null = admin
    ? {
        admin,
        showToast,
        refreshSession,
        logout,
      }
    : null;

  if (loading) {
    return (
      <main className="admin-page admin-page-centered">
        <LoadingScreen title="운영 세션 확인 중" message="관리자 로그인 상태를 확인하고 있습니다." />
      </main>
    );
  }

  if (!admin || sessionError) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{
          from: location,
          reason: sessionError,
        }}
      />
    );
  }

  return (
    <>
      <main className="admin-page">
        <div className={`admin-dashboard-shell ${isSidebarMode && isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
          <aside className="admin-sidebar" id="admin-sidebar-panel">
            <section className="admin-topbar">
              <div className="admin-sidebar-brand">
                {/* <div className="admin-sidebar-mark" aria-hidden="true">
                  <BrandGridIcon className="admin-sidebar-mark-icon" />
                </div> */}
                <div className="admin-topbar-copy">
                  <p className="section-kicker">Admin Console</p>
                  <h1>관리자 페이지</h1>
                </div>
              </div>

              {isSidebarMode ? (
                <button
                  aria-controls="admin-sidebar-panel"
                  aria-expanded={!isSidebarCollapsed}
                  aria-label={isSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                  className="admin-sidebar-toggle"
                  type="button"
                  onClick={toggleSidebar}
                >
                  <PanelToggleIcon className="admin-sidebar-toggle-icon" collapsed={isSidebarCollapsed} />
                </button>
              ) : null}
            </section>

            <section className="admin-admin-badge">
              <div className="admin-admin-badge-avatar" aria-hidden="true">
                {admin.name.slice(0, 1)}
              </div>
              <div className="admin-admin-badge-copy">
                <strong>{admin.name}</strong>
                <span>
                  {admin.loginId} · {admin.role}
                </span>
              </div>
            </section>

            <nav className="admin-nav" aria-label="관리자 주요 메뉴" id="admin-primary-navigation">
              <section className="admin-nav-section">
                <div className="admin-nav-section-header">
                  <p className="section-kicker">Section</p>
                  <h2>운영 메뉴</h2>
                </div>

                <div className="admin-nav-list">
                  {adminPrimaryNavItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink aria-label={item.label} className={navClassName} key={item.to} title={item.label} to={item.to}>
                        <span className="admin-nav-link-icon" aria-hidden="true">
                          <Icon className="admin-nav-link-icon-svg" />
                        </span>
                        <span className="admin-nav-link-copy">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            </nav>

            <div className="admin-sidebar-footer">
              <button
                aria-label="로그아웃"
                className="admin-sidebar-action"
                title="로그아웃"
                type="button"
                onClick={() => void logout()}
              >
                <span className="admin-nav-link-icon" aria-hidden="true">
                  <LogoutIcon className="admin-nav-link-icon-svg" />
                </span>
                <span className="admin-nav-link-copy">
                  <strong>로그아웃</strong>
                  <small>현재 운영 세션 종료</small>
                </span>
              </button>
            </div>
          </aside>

          <div className={`admin-content ${isSidebarMode && isSidebarCollapsed ? 'is-sidebar-collapsed-offset' : ''}`}>
            <Outlet context={outletContext} />
          </div>
        </div>
      </main>

      <AdminToastRegion toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
