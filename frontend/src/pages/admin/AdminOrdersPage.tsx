import { FormEvent, useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';

import { AdminOrderListItem, PaginationMeta, StoreOrderStatus, apiClient } from '../../lib/api';
import {
  AdminLayoutContext,
  formatAdminDateTime,
  formatAdminPhone,
  formatCurrency,
  getDepositStatusLabel,
  getOrderStatusLabel,
  getShipmentStatusLabel,
} from './adminUtils';

const DEFAULT_META: PaginationMeta = {
  page: 1,
  size: 10,
  totalItems: 0,
  totalPages: 0,
};

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

  const q = searchParams.get('q') ?? '';
  const orderStatusParam = searchParams.get('orderStatus') ?? 'all';
  const page = parsePage(searchParams.get('page'));

  const loadOrders = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminOrders({
        q: q || undefined,
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
  }, [orderStatusParam, page, q]);

  const onFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const next = new URLSearchParams();
    const nextQuery = String(formData.get('q') ?? '').trim();
    const nextStatus = String(formData.get('orderStatus') ?? 'all');

    if (nextQuery) {
      next.set('q', nextQuery);
    }

    if (nextStatus !== 'all') {
      next.set('orderStatus', nextStatus);
    }

    next.set('page', '1');
    setSearchParams(next);
  };

  const onMovePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Orders</p>
          <h2 className="section-title admin-section-title">주문 관리</h2>
          <p className="section-copy">주문 상태와 입금, 배송 진행 상황을 한 화면에서 조회하고 상세 운영 화면으로 연결합니다.</p>
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
              name="q"
              defaultValue={q}
              placeholder="주문번호, 구매자명, 수령인명 검색"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span>주문 상태</span>
            <select name="orderStatus" defaultValue={orderStatusParam}>
              <option value="all">전체</option>
              <option value="PENDING_PAYMENT">입금 대기</option>
              <option value="PAYMENT_REQUESTED">입금 요청 확인 중</option>
              <option value="PAYMENT_CONFIRMED">입금 확인 완료</option>
              <option value="PREPARING">제작 및 출고 준비</option>
              <option value="SHIPPED">배송 중</option>
              <option value="DELIVERED">배송 완료</option>
              <option value="CANCELLED">주문 취소</option>
              <option value="EXPIRED">입금 기한 만료</option>
            </select>
          </label>
        </div>

        <div className="inline-actions">
          <button className="button" type="submit">
            조건 적용
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

        {loading ? <p className="feedback-copy">주문 목록을 불러오는 중입니다.</p> : null}
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
                      <strong>{order.orderNumber}</strong>
                      <p>
                        주문 생성 {formatAdminDateTime(order.createdAt)} · 최근 변경 {formatAdminDateTime(order.updatedAt)}
                      </p>
                    </div>
                    <div className="admin-pill-row">
                      <span className="status-pill">{getOrderStatusLabel(order.orderStatus)}</span>
                      <span className="status-pill is-muted">{getDepositStatusLabel(order.depositStatus)}</span>
                      <span className="status-pill is-muted">{getShipmentStatusLabel(order.shipmentStatus)}</span>
                    </div>
                  </div>

                  <div className="admin-product-summary">
                    <span>{formatCurrency(order.finalTotalPrice)}</span>
                    <span>상품 {order.itemCount}건</span>
                  </div>

                  <div className="admin-meta-row">
                    <span>
                      구매자 {order.buyerName} · {formatAdminPhone(order.buyerPhone)}
                    </span>
                    <span>
                      수령인 {order.receiverName} · {formatAdminPhone(order.receiverPhone)}
                    </span>
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
