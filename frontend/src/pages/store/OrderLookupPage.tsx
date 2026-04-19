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
    return '아직 기록되지 않았습니다.';
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

function getOrderStatusLabel(status: StoreOrderStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return '입금 대기';
    case 'PAYMENT_REQUESTED':
      return '입금 요청 확인 중';
    case 'PAYMENT_CONFIRMED':
      return '입금 확인 완료';
    case 'PREPARING':
      return '상품 준비 중';
    case 'SHIPPED':
      return '배송 중';
    case 'DELIVERED':
      return '배송 완료';
    case 'CANCELLED':
      return '주문 취소';
    case 'EXPIRED':
      return '입금 기한 만료';
    default:
      return status;
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
      description: '주문이 생성되어 확인 가능한 상태가 되었습니다.',
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
        title: '입금 확인 요청',
        description: '고객의 입금 확인 요청이 접수되었습니다.',
        occurredAt: order.deposit.requestedAt,
        variant: order.deposit.depositStatus === 'REQUESTED' ? 'current' : 'complete',
      });
    }

    if (order.deposit.confirmedAt) {
      items.push({
        key: 'deposit-confirmed',
        title: '입금 확인 완료',
        description: '결제가 확인되어 다음 제작 단계로 진행할 수 있습니다.',
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
  const locationState = location.state as OrderLookupLocationState | null;
  const createdOrder = locationState?.createdOrder ?? null;

  const [orderNumberInput, setOrderNumberInput] = useState(searchOrderNumber);
  const [order, setOrder] = useState<StoreOrderLookupResponse | null>(null);
  const [tracking, setTracking] = useState<StoreOrderTrackingResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setOrderNumberInput(searchOrderNumber);
  }, [searchOrderNumber]);

  useEffect(() => {
    if (!searchOrderNumber) {
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
        apiClient.getOrderByNumber(searchOrderNumber),
        apiClient.getOrderTracking(searchOrderNumber),
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
  }, [createdOrder, refreshKey, searchOrderNumber]);

  const timelineItems = order ? buildTimeline(order, tracking) : [];
  const activeTracking = tracking ?? (order ? buildFallbackTracking(order) : null);
  const currentShipmentStatus = activeTracking?.shipmentStatus ?? order?.shipment.shipmentStatus ?? null;
  const depositExpectedAmount = order?.deposit.expectedAmount ?? order?.pricing.finalTotalPrice ?? 0;

  const onLookupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextOrderNumber = normalizeOrderNumber(orderNumberInput);

    if (!nextOrderNumber) {
      setLookupError('주문번호를 입력해 주세요.');
      setOrder(null);
      setTracking(null);
      return;
    }

    const nextParams = new URLSearchParams();
    nextParams.set('orderNumber', nextOrderNumber);
    setSearchParams(nextParams);

    if (nextOrderNumber === searchOrderNumber) {
      setRefreshKey((value) => value + 1);
    }
  };

  return (
    <main className="m-page order-lookup-page">
      <section className="surface-hero compact-hero order-lookup-intro">
        <p className="section-kicker">Order Lookup</p>
        <h1 className="section-title">주문 조회</h1>
        <p className="section-copy">
          주문번호를 통해 주문 상태, 입금 진행, 배송 상태를 확인할 수 있습니다.
        </p>

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

          <div className="lookup-input-row" style={{ marginTop: '18px' }}>
            <label className="field">
              <input
                value={orderNumberInput}
                onChange={(event) => setOrderNumberInput(event.target.value)}
                placeholder="예: DM20260327-0001"
                autoComplete="off"
                inputMode="text"
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
                <p className="section-kicker">Overview</p>
                <h2 className="section-subtitle">{order.orderNumber}</h2>
              </div>
              <span className="status-pill">{getOrderStatusLabel(order.orderStatus)}</span>
            </div>

            <div className="order-lookup-grid">
              <div className="order-lookup-block">
                <h3>주문 기본정보</h3>
                <div className="order-summary-row">
                  <span>주문 상태</span>
                  <strong>{getOrderStatusLabel(order.orderStatus)}</strong>
                </div>
                <div className="order-summary-row">
                  <span>주문 시각</span>
                  <strong>{formatDateTime(order.createdAt)}</strong>
                </div>
                {/* <div className="order-summary-row">
                  <span>배송 상태</span>
                  <strong>
                    {hasShipmentStarted(activeTracking?.shipmentStatus ?? order.shipment.shipmentStatus)
                      ? getShipmentStatusLabel(activeTracking?.shipmentStatus ?? order.shipment.shipmentStatus)
                      : '-'}
                  </strong>
                </div> */}
              </div>

              <div className="order-lookup-block">
                <h3>배송지 정보</h3>
                <div className="lookup-contact-copy">
                  <strong>{order.contact.receiverName}</strong>
                  <span>{formatPhone(order.contact.receiverPhone)}</span>
                </div>
                <p className="lookup-address">
                  [{order.contact.zipcode}] {order.contact.address1}
                  {order.contact.address2 ? ` ${order.contact.address2}` : ''}
                </p>
              </div>
            </div>
          </section>

          <section className="surface-card order-lookup-summary">
            <div className="section-head">
              <div>
                <p className="section-kicker">Order Items</p>
                <h2 className="section-subtitle">주문 상품</h2>
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
                <p className="section-kicker">Tracking</p>
                <h2 className="section-subtitle">주문 트래킹</h2>
              </div>
              {currentShipmentStatus ? (
                <span className={`status-pill ${getShipmentStatusPillClass(currentShipmentStatus)}`}>
                  {getShipmentStatusLabel(currentShipmentStatus)}
                </span>
              ) : null}
              {activeTracking?.trackingUrl && activeTracking.trackingNumber ? (
                <a className="button-text" href={activeTracking.trackingUrl} target="_blank" rel="noreferrer">
                  운송장 보기
                </a>
              ) : null}
            </div>

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
                  <strong>
                    {hasShipmentStarted(currentShipmentStatus) ? activeTracking?.trackingNumber ?? '-' : '-'}
                  </strong>
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
          </section>

          <section className="surface-card order-lookup-summary">
            <div className="section-head">
              <div>
                <p className="section-kicker">Deposit</p>
                <h2 className="section-subtitle">입금 정보</h2>
              </div>
              <span className="status-pill">{getDepositStatusLabel(order.deposit.depositStatus)}</span>
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
