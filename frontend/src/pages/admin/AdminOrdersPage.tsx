import { FormEvent, useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminOrderListItem, PaginationMeta, StoreOrderStatus, apiClient } from '../../lib/api';
import {
  AdminLayoutContext,
  formatAdminDateTime,
  formatAdminPhone,
  formatCurrency,
  getOrderStatusLabel,
} from './adminUtils';

const DEFAULT_META: PaginationMeta = {
  page: 1,
  size: 10,
  totalItems: 0,
  totalPages: 0,
};

const ORDER_STATUS_FILTER_OPTIONS: Array<{ value: 'all' | StoreOrderStatus; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'PENDING_PAYMENT', label: '입금 대기' },
  { value: 'PAYMENT_CONFIRMED', label: '입금 확인 완료' },
  { value: 'PREPARING', label: '상품 준비 중' },
  { value: 'SHIPPED', label: '배송 중' },
  { value: 'DELIVERED', label: '배송 완료' },
  { value: 'CANCELLED', label: '주문 취소' },
  { value: 'EXPIRED', label: '입금 기한 만료' },
];

function parseOrderStatusFilter(value: string | null): StoreOrderStatus | undefined {
  if (
    value === 'PENDING_PAYMENT' ||
    value === 'PAYMENT_CONFIRMED' ||
    value === 'PREPARING' ||
    value === 'SHIPPED' ||
    value === 'DELIVERED' ||
    value === 'CANCELLED' ||
    value === 'EXPIRED'
  ) {
    return value;
  }

  return undefined;
}

function parsePage(value: string | null): number {
  const parsed = Number(value ?? '1');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function AdminOrdersPage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(DEFAULT_META);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<AdminOrderListItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const keyword = searchParams.get('keyword') ?? searchParams.get('q') ?? '';
  const orderStatusParam = searchParams.get('orderStatus') ?? 'all';
  const page = parsePage(searchParams.get('page'));

  const loadOrders = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminOrders({
        keyword: keyword || undefined,
        orderStatus: parseOrderStatusFilter(orderStatusParam === 'all' ? null : orderStatusParam),
        page,
        size: 10,
      });

      setOrders(result.data.items);
      setMeta(result.meta);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '주문 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [keyword, orderStatusParam, page]);

  useEffect(() => {
    if (!pendingDeleteOrder) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && deletingId === null) {
        setPendingDeleteOrder(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deletingId, pendingDeleteOrder]);

  const onFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const next = new URLSearchParams();
    const nextQuery = String(formData.get('keyword') ?? '').trim();

    if (nextQuery) {
      next.set('keyword', nextQuery);
    }

    if (orderStatusParam !== 'all') {
      next.set('orderStatus', orderStatusParam);
    }

    next.set('page', '1');
    setSearchParams(next);
  };

  const onMovePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const onSelectOrderStatusFilter = (status: 'all' | StoreOrderStatus) => {
    const next = new URLSearchParams(searchParams);

    if (status === 'all') {
      next.delete('orderStatus');
    } else {
      next.set('orderStatus', status);
    }

    next.set('page', '1');
    setSearchParams(next);
  };

  const onConfirmDelete = async () => {
    if (!pendingDeleteOrder) {
      return;
    }

    const orderToDelete = pendingDeleteOrder;
    setDeletingId(orderToDelete.id);
    setError('');

    try {
      await apiClient.deleteAdminOrder(orderToDelete.id);
      setPendingDeleteOrder(null);
      showToast(`주문번호 ${orderToDelete.orderNumber} 주문을 삭제했습니다.`);

      if (orders.length === 1 && page > 1) {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(page - 1));
        setSearchParams(next);
      } else {
        await loadOrders();
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '주문 삭제에 실패했습니다.';
      setPendingDeleteOrder(null);
      setError(message);
      showToast(message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Orders</p>
          <h2 className="section-title admin-section-title">주문 관리</h2>
          {/* <p className="section-copy">주문 상태와 입금, 배송 진행 상황을 한 화면에서 조회하고 상세 운영 화면으로 연결합니다.</p> */}
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>검색 결과</span>
            <strong>{meta.totalItems}</strong>
          </div>
          <div className="admin-stat-card">
            <span>현재 페이지</span>
            <strong>{meta.page}</strong>
          </div>
          <div className="admin-stat-card">
            <span>총 페이지</span>
            <strong>{meta.totalPages || 1}</strong>
          </div>
        </div>
      </section>

      <form className="surface-card admin-card-stack admin-filter-panel" onSubmit={onFilterSubmit}>
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">Filters</p>
            <h3 className="section-subtitle">주문 조회 조건</h3>
          </div>
          <button className="button button-ghost" type="button" onClick={() => void loadOrders()} disabled={loading}>
            새로고침
          </button>
        </div>


        <div className="admin-field-grid">
          <label className="field">
            <span>검색어</span>
            <input
              name="keyword"
              defaultValue={keyword}
              placeholder="주문번호, 이름, 전화번호 검색"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="inline-actions">
          <button className="button" type="submit">
            검색
          </button>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setSearchParams(new URLSearchParams({ page: '1' }));
              showToast('주문 필터를 초기화했습니다.', 'info');
            }}
          >
            초기화
          </button>
        </div>
      </form>
      
      <section className="surface-card admin-card-stack">
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">List</p>
            <h3 className="section-subtitle">주문 목록</h3>
          </div>
          <span className="admin-inline-note">{meta.totalItems}건</span>
        </div>
        
        <div className="admin-status-filter-row" role="tablist" aria-label="주문 상태 필터">
          {ORDER_STATUS_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`admin-status-filter-button ${orderStatusParam === option.value ? 'is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={orderStatusParam === option.value}
              onClick={() => onSelectOrderStatusFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? <LoadingScreen mode="inline" title="주문 목록 로딩 중" message="주문 목록을 불러오고 있습니다." /> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && orders.length === 0 ? (
          <section className="admin-empty-state">
            <p className="section-kicker">Empty</p>
            <h4 className="section-subtitle">조건에 맞는 주문이 없습니다</h4>
            <p className="section-copy">검색어 또는 주문 상태 조건을 조정해 다시 조회할 수 있습니다.</p>
          </section>
        ) : null}

        {!loading && !error && orders.length > 0 ? (
          <>
            <div className="admin-list-grid">
              {orders.map((order) => (
                <article className="admin-list-card admin-order-list-card" key={order.id}>
                  <Link className="admin-order-card-link" to={`/admin/orders/${order.id}`}>
                    <div className="admin-list-card-head">
                      <div>
                        <strong>
                          {order.buyerName} · {formatAdminPhone(order.buyerPhone)}
                        </strong>
                        <p>
                          수령인 {order.receiverName} · {formatAdminPhone(order.receiverPhone)}
                        </p>
                      </div>
                    </div>

                    <div className="admin-product-summary">
                      <span>{formatCurrency(order.finalTotalPrice)}</span>
                      <span>상품 {order.itemCount}건</span>
                    </div>

                    <div className="admin-meta-row">
                      <span>주문번호 {order.orderNumber}</span>
                      <span>주문 생성 {formatAdminDateTime(order.createdAt)}</span>
                    </div>
                  </Link>

                  <div className="admin-order-card-toolbar">
                    <span className="status-pill">{getOrderStatusLabel(order.orderStatus)}</span>
                    <button
                      className="admin-order-delete-button"
                      type="button"
                      aria-label={`주문번호 ${order.orderNumber} 삭제`}
                      title="주문 삭제"
                      onClick={() => setPendingDeleteOrder(order)}
                      disabled={deletingId !== null}
                    >
                      <TrashIcon />
                    </button>
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
      </section>

      {pendingDeleteOrder ? (
        <div
          className="admin-order-delete-overlay"
          role="presentation"
          onClick={deletingId === null ? () => setPendingDeleteOrder(null) : undefined}
        >
          <section
            className="admin-order-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-order-delete-title"
            aria-describedby="admin-order-delete-description"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-order-delete-copy">
              <p className="section-kicker">Delete Order</p>
              <h2 className="section-subtitle" id="admin-order-delete-title">
                진짜 삭제하시겠습니까?
              </h2>
              <p className="feedback-copy" id="admin-order-delete-description">
                주문번호 {pendingDeleteOrder.orderNumber}의 주문 데이터가 DB에서 영구적으로 삭제됩니다.
              </p>
            </div>

            <div className="admin-order-delete-actions">
              <button
                className="button button-secondary"
                type="button"
                autoFocus
                onClick={() => setPendingDeleteOrder(null)}
                disabled={deletingId !== null}
              >
                아니오
              </button>
              <button
                className="button admin-order-delete-confirm"
                type="button"
                onClick={() => void onConfirmDelete()}
                disabled={deletingId !== null}
              >
                {deletingId !== null ? '삭제 중...' : '예'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="m6.5 7 1 13h9l1-13" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}
