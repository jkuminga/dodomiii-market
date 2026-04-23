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
  { value: 'PAYMENT_REQUESTED', label: '입금 요청 확인 중' },
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
    value === 'PAYMENT_REQUESTED' ||
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
                <Link className="admin-list-card admin-order-list-card" key={order.id} to={`/admin/orders/${order.id}`}>
                  <div className="admin-list-card-head">
                    <div>
                      <strong>
                        {order.buyerName} · {formatAdminPhone(order.buyerPhone)}
                      </strong>
                      <p>
                        수령인 {order.receiverName} · {formatAdminPhone(order.receiverPhone)}
                      </p>
                    </div>
                    <span className="status-pill">{getOrderStatusLabel(order.orderStatus)}</span>
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
    </section>
  );
}
