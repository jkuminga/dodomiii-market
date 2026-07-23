import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import {
  apiClient,
  StoreDepositStatus,
  StoreOrderCreateResponse,
  StoreOrderLookupResponse,
  StoreOrderStatus,
  StoreOrderTrackingResponse,
  StoreShipmentStatus,
} from '../../lib/api';

type OrderLookupLocationState = {
  createdOrder?: StoreOrderCreateResponse;
};

type TimelineItem = {
  key: string;
  title: string;
  description: string;
  occurredAt: string | null;
  variant: 'complete' | 'current' | 'pending';
  linkUrl?: string | null;
  linkLabel?: string;
};

function normalizeOrderNumber(value: string): string {
  return value.trim().toUpperCase();
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value;
}

async function copyToClipboard(value: string): Promise<boolean> {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const input = document.createElement('textarea');
  input.value = trimmed;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.append(input);
  input.focus();
  input.select();

  const copied = Boolean(document.execCommand('copy'));
  document.body.removeChild(input);
  return copied;
}

function getOrderStatusLabel(status: StoreOrderStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return '결제 대기';
    case 'PAYMENT_REQUESTED':
      return '결제 확인 요청';
    case 'PAYMENT_CONFIRMED':
      return '결제 확인 완료';
    case 'PREPARING':
      return '상품 준비 중';
    case 'SHIPPED':
      return '배송 중';
    case 'DELIVERED':
      return '배송 완료';
    case 'CANCELLED':
      return '주문 취소';
    case 'EXPIRED':
      return '주문 만료';
    default:
      return status;
  }
}

function getOrderStatusPillClass(status: StoreOrderStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
    case 'PREPARING':
      return 'is-order-yellow';
    case 'PAYMENT_REQUESTED':
    case 'DELIVERED':
      return 'is-order-blue';
    case 'PAYMENT_CONFIRMED':
    case 'SHIPPED':
      return 'is-order-green';
    case 'CANCELLED':
      return 'is-order-red';
    case 'EXPIRED':
      return 'is-order-black';
    default:
      return '';
  }
}

function getDepositStatusLabel(status: StoreDepositStatus): string {
  switch (status) {
    case 'WAITING':
      return '입금 대기';
    case 'REQUESTED':
      return '입금 확인 요청 완료';
    case 'CONFIRMED':
      return '입금 확인 완료';
    case 'REJECTED':
      return '입금 재확인 필요';
    default:
      return status;
  }
}

function getDepositStatusPillClass(status: StoreDepositStatus): string {
  switch (status) {
    case 'WAITING':
      return 'is-deposit-waiting';
    case 'REQUESTED':
      return 'is-deposit-requested';
    case 'CONFIRMED':
      return 'is-deposit-confirmed';
    case 'REJECTED':
      return 'is-deposit-rejected';
    default:
      return '';
  }
}

function getShipmentStatusLabel(status: StoreShipmentStatus): string {
  switch (status) {
    case 'READY':
      return '배송 준비 중';
    case 'SHIPPED':
      return '배송 중';
    case 'DELIVERED':
      return '배송 완료';
    default:
      return status;
  }
}

function getShipmentStatusPillClass(status: StoreShipmentStatus): string {
  switch (status) {
    case 'READY':
      return 'is-shipment-ready';
    case 'SHIPPED':
      return 'is-shipment-shipped';
    case 'DELIVERED':
      return 'is-shipment-delivered';
    default:
      return '';
  }
}

function hasShipmentStarted(status: StoreShipmentStatus | null | undefined): boolean {
  return status === 'SHIPPED' || status === 'DELIVERED';
}

function buildFallbackTracking(order: StoreOrderLookupResponse): StoreOrderTrackingResponse {
  return {
    orderNumber: order.orderNumber,
    shipmentStatus: order.shipment.shipmentStatus,
    courierName: order.shipment.courierName,
    trackingNumber: order.shipment.trackingNumber,
    trackingUrl: order.shipment.trackingUrl ?? null,
    shippedAt: order.shipment.shippedAt,
    deliveredAt: order.shipment.deliveredAt,
  };
}

function mergeLookupWithCreatedOrder(
  order: StoreOrderLookupResponse,
  createdOrder: StoreOrderCreateResponse | null,
): StoreOrderLookupResponse {
  if (!createdOrder || createdOrder.orderNumber !== order.orderNumber) {
    return order;
  }

  return {
    ...order,
    createdAt: order.createdAt ?? createdOrder.createdAt,
    deposit: {
      ...order.deposit,
      bankName: order.deposit.bankName ?? createdOrder.depositInfo.bankName,
      accountHolder: order.deposit.accountHolder ?? createdOrder.depositInfo.accountHolder,
      accountNumber: order.deposit.accountNumber ?? createdOrder.depositInfo.accountNumber,
      expectedAmount: order.deposit.expectedAmount ?? createdOrder.depositInfo.expectedAmount,
    },
  };
}

function buildTimeline(order: StoreOrderLookupResponse, tracking: StoreOrderTrackingResponse | null): TimelineItem[] {
  const items: TimelineItem[] = [];
  const shipment = tracking ?? buildFallbackTracking(order);

  if (order.createdAt) {
    items.push({
      key: 'created',
      title: '주문 접수',
      description: '주문이 접수되었습니다. 고객님의 입금을 대기 중입니다.',
      occurredAt: order.createdAt,
      variant: 'complete',
    });
  }

  if (order.statusHistories && order.statusHistories.length > 0) {
    const sortedHistories = [...order.statusHistories].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    for (const history of sortedHistories) {
      items.push({
        key: `history-${history.orderStatusHistoryId}`,
        title: getOrderStatusLabel(history.newStatus),
        description: history.changeReason ?? '주문 상태가 업데이트되었습니다.',
        occurredAt: history.createdAt,
        variant: history.newStatus === order.orderStatus ? 'current' : 'complete',
      });
    }
  } else {
    if (order.deposit.requestedAt) {
      items.push({
        key: 'deposit-requested',
        title: '입금 완료 / 확인 대기 중',
        description: '판매자가 고객님의 입금을 확인하면 주문이 확정됩니다. 조금만 기다려주세요',
        occurredAt: order.deposit.requestedAt,
        variant: order.deposit.depositStatus === 'REQUESTED' ? 'current' : 'complete',
      });
    }

    if (order.deposit.confirmedAt) {
      items.push({
        key: 'deposit-confirmed',
        title: '입금 확인 완료',
        description: '결제가 완료되어 상품의 작업이 진행 중 입니다.',
        occurredAt: order.deposit.confirmedAt,
        variant:
          order.orderStatus === 'PAYMENT_CONFIRMED' || order.orderStatus === 'PREPARING' || order.orderStatus === 'SHIPPED' || order.orderStatus === 'DELIVERED'
            ? 'complete'
            : 'current',
      });
    }

    if (shipment.shippedAt) {
      items.push({
        key: 'shipment-shipped',
        title: '배송 출발',
        description: shipment.courierName
          ? `${shipment.courierName}로 발송되었습니다.`
          : '배송이 시작되었습니다.',
        occurredAt: shipment.shippedAt,
        variant: shipment.shipmentStatus === 'SHIPPED' ? 'current' : 'complete',
        linkUrl: shipment.trackingUrl,
        linkLabel: shipment.trackingNumber ? `운송장 ${shipment.trackingNumber}` : undefined,
      });
    }

    if (shipment.deliveredAt) {
      items.push({
        key: 'shipment-delivered',
        title: '배송 완료',
        description: '배송이 완료되었습니다.',
        occurredAt: shipment.deliveredAt,
        variant: order.orderStatus === 'DELIVERED' ? 'current' : 'complete',
      });
    }
  }

  if (items.length === 0) {
    items.push({
      key: 'current-status',
      title: getOrderStatusLabel(order.orderStatus),
      description: '현재 확인된 최신 주문 상태입니다.',
      occurredAt: order.updatedAt,
      variant: 'current',
    });
  }

  return items.sort((left, right) => {
    if (left.occurredAt && right.occurredAt) {
      return left.occurredAt.localeCompare(right.occurredAt);
    }

    if (left.occurredAt) {
      return -1;
    }

    if (right.occurredAt) {
      return 1;
    }

    return 0;
  });
}

export function OrderLookupPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchOrderNumber = normalizeOrderNumber(searchParams.get('orderNumber') ?? '');
  const searchContactPhone = searchParams.get('contactPhone') ?? '';
  const locationState = location.state as OrderLookupLocationState | null;
  const createdOrder = locationState?.createdOrder ?? null;

  const [orderNumberInput, setOrderNumberInput] = useState(searchOrderNumber);
  const [contactPhoneInput, setContactPhoneInput] = useState(searchContactPhone);
  const [order, setOrder] = useState<StoreOrderLookupResponse | null>(null);
  const [tracking, setTracking] = useState<StoreOrderTrackingResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [copyToast, setCopyToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setOrderNumberInput(searchOrderNumber);
  }, [searchOrderNumber]);

  useEffect(() => {
    setContactPhoneInput(searchContactPhone);
  }, [searchContactPhone]);

  useEffect(() => {
    if (!searchOrderNumber || !searchContactPhone) {
      setOrder(null);
      setTracking(null);
      setLookupLoading(false);
      setLookupError('');
      setTrackingError('');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLookupLoading(true);
      setLookupError('');
      setTrackingError('');

      const [orderResult, trackingResult] = await Promise.allSettled([
        apiClient.getOrderByNumber(searchOrderNumber, searchContactPhone),
        apiClient.getOrderTracking(searchOrderNumber, searchContactPhone),
      ]);

      if (cancelled) {
        return;
      }

      if (orderResult.status === 'rejected') {
        setOrder(null);
        setTracking(null);
        setLookupError(orderResult.reason instanceof Error ? orderResult.reason.message : '주문 정보를 불러오지 못했습니다.');
        setLookupLoading(false);
        return;
      }

      const nextOrder = mergeLookupWithCreatedOrder(orderResult.value, createdOrder);
      setOrder(nextOrder);

      if (trackingResult.status === 'fulfilled') {
        setTracking(trackingResult.value);
      } else {
        setTracking(buildFallbackTracking(nextOrder));
        setTrackingError(
          trackingResult.reason instanceof Error
            ? trackingResult.reason.message
            : '배송 트래킹 정보를 별도로 불러오지 못했습니다.',
        );
      }

      setLookupLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [createdOrder, refreshKey, searchContactPhone, searchOrderNumber]);

  const timelineItems = order ? buildTimeline(order, tracking) : [];
  const activeTracking = tracking ?? (order ? buildFallbackTracking(order) : null);
  const currentShipmentStatus = activeTracking?.shipmentStatus ?? order?.shipment.shipmentStatus ?? null;
  const depositExpectedAmount = order?.deposit.expectedAmount ?? order?.pricing.finalTotalPrice ?? 0;

  useEffect(() => {
    if (!copyToast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopyToast(null);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [copyToast]);

  const onLookupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextOrderNumber = normalizeOrderNumber(orderNumberInput);

    if (!nextOrderNumber) {
      setLookupError('주문번호를 입력해 주세요.');
      setOrder(null);
      setTracking(null);
      return;
    }

    const nextContactPhone = contactPhoneInput.trim();

    if (!nextContactPhone) {
      setLookupError('주문 시 입력한 연락처를 입력해 주세요.');
      setOrder(null);
      setTracking(null);
      return;
    }

    const nextParams = new URLSearchParams();
    nextParams.set('orderNumber', nextOrderNumber);
    nextParams.set('contactPhone', nextContactPhone);
    setSearchParams(nextParams);

    if (nextOrderNumber === searchOrderNumber && nextContactPhone === searchContactPhone) {
      setRefreshKey((value) => value + 1);
    }
  };

  const handleCopyTrackingNumber = async () => {
    const trackingNumber = activeTracking?.trackingNumber?.trim() ?? '';

    if (!trackingNumber) {
      setCopyToast({ message: '복사할 운송장 번호가 없습니다.', variant: 'error' });
      return;
    }

    const copied = await copyToClipboard(trackingNumber);

    setCopyToast(
      copied
        ? { message: '운송장 번호를 복사했습니다.', variant: 'success' }
        : { message: '운송장 번호 복사에 실패했습니다.', variant: 'error' },
    );
  };

  return (
    <main className="m-page order-lookup-page">
      {copyToast ? (
        <div className={`payment-copy-toast ${copyToast.variant === 'success' ? 'is-success' : 'is-error'}`} role="status" aria-live="polite">
          {copyToast.message}
        </div>
      ) : null}
      <section className="surface-hero compact-hero order-lookup-intro">
        <p className="section-kicker">Order Lookup</p>
        <h1 className="section-title">주문 조회</h1>

        <form className="order-lookup-form" onSubmit={onLookupSubmit}>
          {/* <div className="section-head">
            <div>
              <p className="section-kicker">Find Order</p>
              <h2 className="section-subtitle">주문번호 입력</h2>
            </div>
            {searchOrderNumber ? (
              <button className="button-text" type="button" onClick={() => setRefreshKey((value) => value + 1)}>
                새로고침
              </button>
            ) : null}
          </div> */}

          <div className="lookup-input-row order-lookup-fields" style={{ marginTop: '18px' }}>
            <label className="field lookup-icon-field">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </span>
              <span className="field-divider" aria-hidden="true"></span>
              <input
                value={orderNumberInput}
                onChange={(event) => setOrderNumberInput(event.target.value)}
                placeholder="예: DM20260327-0001"
                autoComplete="off"
                inputMode="text"
              />
            </label>

            <label className="field lookup-icon-field">
              <span className="field-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </span>
              <span className="field-divider" aria-hidden="true"></span>
              <input
                value={contactPhoneInput}
                onChange={(event) => setContactPhoneInput(event.target.value)}
                placeholder="주문 시 입력한 연락처"
                autoComplete="tel"
                inputMode="tel"
              />
            </label>

            <button className="button" type="submit" disabled={lookupLoading}>
              {lookupLoading ? '조회 중...' : '조회하기'}
            </button>
          </div>
        </form>
      </section>

      {(lookupError || order || searchOrderNumber) ? <div className="order-lookup-divider" aria-hidden="true" /> : null}

      {lookupError ? (
        <section className="surface-card status-card" role="alert">
          <p className="section-kicker" style={{ 'color': 'black' }}>Unavailable</p>
          <p className="feedback-copy is-error">{lookupError}</p>
        </section>
      ) : null}

      {/* {!searchOrderNumber && !order ? (
        <section className="surface-card status-card">
          <p className="section-kicker">Ready</p>
          <h2 className="section-subtitle">조회 준비 완료</h2>
          <p className="feedback-copy">주문번호를 입력하면 최신 주문 상태와 트래킹 정보를 바로 불러옵니다.</p>
        </section>
      ) : null} */}

      {order ? (
        <>
          <section className="surface-card order-lookup-summary">
            <div className="section-head">
              <div>
                <p className="section-kicker block-title-with-icon" style={{ gap: '4px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block-icon" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  Overview
                </p>
                <h2 className="section-subtitle">
                  {order.orderNumber}
                </h2>
              </div>
              <span className={`status-pill ${getOrderStatusPillClass(order.orderStatus)}`}>
                {getOrderStatusLabel(order.orderStatus)}
              </span>
            </div>

            <div className="order-lookup-grid">
              <div className="order-lookup-block">
                <h3 className="block-title-with-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block-icon" style={{ width: '18px', height: '18px' }} aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  주문 기본정보
                </h3>
                <div className="order-summary-row">
                  <span>주문 상태</span>
                  <strong>{getOrderStatusLabel(order.orderStatus)}</strong>
                </div>
                <div className="order-summary-row">
                  <span>주문 시각</span>
                  <strong>{formatDateTime(order.createdAt)}</strong>
                </div>
              </div>

              <div className="order-lookup-block">
                <h3 className="block-title-with-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block-icon" style={{ width: '18px', height: '18px' }} aria-hidden="true">
                    <rect x="1" y="3" width="15" height="13"></rect>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                  </svg>
                  배송지 정보
                </h3>
                <div className="order-summary-row">
                  <span>수령인</span>
                  <strong>
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span>{order.contact.receiverName}  |  {formatPhone(order.contact.receiverPhone)}</span>
                    </div>
                  </strong>
                </div>
                <div className="order-summary-row">
                  <span>배송지 주소</span>
                  <strong>
                    <div style={{ display: 'grid', gap: '2px' }}>
                      <span>[{order.contact.zipcode}] {order.contact.address1}{order.contact.address2 ? ` ${order.contact.address2}` : ''}</span>
                    </div>
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <section className="surface-card order-lookup-summary">
            <div className="section-head">
              <div>
                <p className="section-kicker block-title-with-icon" style={{ gap: '4px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block-icon" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                  Order Items
                </p>
                <h2 className="section-subtitle">
                  주문 상품
                </h2>
              </div>
              {/* <strong className="detail-price">{formatCurrency(order.pricing.finalTotalPrice)}</strong> */}
            </div>

            <ul className="order-item-list">
              {order.items.map((item, index) => (
                <li className="order-item-card" key={`${item.productNameSnapshot}-${index}`}>
                  <div className="order-item-head">
                    <div className="order-item-thumb" aria-hidden="true">
                      {item.thumbnailImageUrl ? (
                        <img src={item.thumbnailImageUrl} alt="" loading="lazy" />
                      ) : (
                        <span>{item.productNameSnapshot.trim().slice(0, 1) || 'D'}</span>
                      )}
                    </div>
                    <div>
                      <strong>{item.productNameSnapshot}</strong>
                      {item.optionNameSnapshot && item.optionValueSnapshot ? (
                        <p>
                          {item.optionNameSnapshot} / {item.optionValueSnapshot}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="order-item-line lookup-item-line">
                    <span>
                      {formatCurrency(item.unitPrice)} x {item.quantity}
                    </span>
                    <strong>{formatCurrency(item.lineTotalPrice)}</strong>
                  </div>
                </li>
              ))}
            </ul>


            <div className='order-lookup-grid'>
              <div className="order-summary-row">
                <span>상품 금액</span>
                <strong>{formatCurrency(order.pricing.totalProductPrice)}</strong>
              </div>
              <div className="order-summary-row">
                <span>배송비</span>
                <strong>{formatCurrency(order.pricing.shippingFee)}</strong>
              </div>
              <div className="order-summary-row is-total">
                <span>최종 결제 금액</span>
                <strong>{formatCurrency(order.pricing.finalTotalPrice)}</strong>
              </div>
            </div>

          </section>

          <section className="surface-card order-lookup-summary">
            <div className="section-head">
              <div>
                <p className="section-kicker block-title-with-icon" style={{ gap: '4px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block-icon" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                    <rect x="1" y="3" width="15" height="13"></rect>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                  </svg>
                  Tracking
                </p>
                <h2 className="section-subtitle">
                  주문 트래킹
                </h2>
              </div>
              {currentShipmentStatus ? (
                <span className={`status-pill ${getShipmentStatusPillClass(currentShipmentStatus)}`}>
                  {getShipmentStatusLabel(currentShipmentStatus)}
                </span>
              ) : null}
              {/* {activeTracking?.trackingUrl && activeTracking.trackingNumber ? (
                <a className="button-text" href={activeTracking.trackingUrl} target="_blank" rel="noreferrer">
                  운송장 보기
                </a>
              ) : null} */}
            </div>

            <ol className="order-timeline" aria-label="주문 진행 타임라인">
              {timelineItems.map((item) => (
                <li className={`timeline-item is-${item.variant}`} key={item.key}>
                  <div className="timeline-rail" aria-hidden="true">
                    <span className="timeline-dot" />
                  </div>
                  <div className="timeline-content">
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <span className="timeline-time">{formatDateTime(item.occurredAt)}</span>
                    {item.linkUrl && item.linkLabel ? (
                      <a className="button-text timeline-link" href={item.linkUrl} target="_blank" rel="noreferrer">
                        {item.linkLabel}
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            <div className="order-lookup-grid">
              <div className="order-lookup-block">
                <div className="order-summary-row">
                  <span>배송 상태</span>
                  {currentShipmentStatus && currentShipmentStatus !== "READY" ? (
                    <span className="order-summary-row">
                      {getShipmentStatusLabel(currentShipmentStatus)}
                    </span>
                  ) : (
                    <span className="order-summary-row">-</span>
                  )}
                </div>
                <div className="order-summary-row">
                  <span>택배사</span>
                  <strong>
                    {hasShipmentStarted(currentShipmentStatus) ? activeTracking?.courierName ?? '-' : '-'}
                  </strong>
                </div>
                <div className="order-summary-row">
                  <span>운송장 번호</span>
                  <div className="order-tracking-number-row">
                    <strong>{hasShipmentStarted(currentShipmentStatus) ? activeTracking?.trackingNumber ?? '-' : '-'}</strong>
                    {hasShipmentStarted(currentShipmentStatus) && activeTracking?.trackingNumber ? (
                      <button
                        className="tracking-copy-button"
                        type="button"
                        onClick={() => void handleCopyTrackingNumber()}
                        aria-label="운송장 번호 복사"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                          <rect x="8" y="7" width="10" height="12" rx="2" />
                          <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="order-lookup-block">
                <div className="order-summary-row">
                  <span>출고 시각</span>
                  <strong>{formatDateTime(activeTracking?.shippedAt)}</strong>
                </div>
                <div className="order-summary-row">
                  <span>배송 완료</span>
                  <strong>{formatDateTime(activeTracking?.deliveredAt)}</strong>
                </div>
                {trackingError ? <p className="feedback-copy">{trackingError}</p> : null}
              </div>
            </div>

            
          </section>

          <section className="surface-card order-lookup-summary">
            <div className="section-head">
              <div>
                <p className="section-kicker block-title-with-icon" style={{ gap: '4px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="block-icon" style={{ width: '14px', height: '14px' }} aria-hidden="true">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  Deposit
                </p>
                <h2 className="section-subtitle">
                  입금 정보
                </h2>
              </div>
              <span className={`status-pill ${getDepositStatusPillClass(order.deposit.depositStatus)}`}>
                {getDepositStatusLabel(order.deposit.depositStatus)}
              </span>
            </div>

            <div className="order-lookup-grid">
              <div className="order-lookup-block">
                <div className="order-summary-row">
                  <span>입금 상태</span>
                  <strong>{getDepositStatusLabel(order.deposit.depositStatus)}</strong>
                </div>
                <div className="order-summary-row">
                  <span>입금 예정 금액</span>
                  <strong>{formatCurrency(depositExpectedAmount)}</strong>
                </div>
              </div>

              <div className="order-lookup-block">
                <div className="order-summary-row">
                  <span>입금 시각</span>
                  <strong>{formatDateTime(order.deposit.requestedAt)}</strong>
                </div>
                <div className="order-summary-row">
                  <span>확인 시각</span>
                  <strong>{formatDateTime(order.deposit.confirmedAt)}</strong>
                </div>
              </div>

              {/* <div className="order-lookup-block">
                <div className="order-summary-row">
                  <span>은행</span>
                  <strong>{order.deposit.bankName ?? '주문 접수 안내 기준'}</strong>
                </div>
                <div className="order-summary-row">
                  <span>예금주</span>
                  <strong>{order.deposit.accountHolder ?? '확인 후 안내'}</strong>
                </div>
                <div className="order-summary-row">
                  <span>계좌번호</span>
                  <strong className="lookup-value-break">
                    {order.deposit.accountNumber ?? '주문 접수 화면에서 확인'}
                  </strong>
                </div>
              </div> */}
            </div>

          </section>
        </>
      ) : null}

      {/* <div className="inline-actions order-inline-actions">
        <Link className="button button-secondary" to="/products">
          상품 둘러보기
        </Link>
      </div> */}
    </main>
  );
}
