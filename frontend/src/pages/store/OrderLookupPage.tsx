import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import {
  apiClient,
  StoreDepositRequestPayload,
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

type DepositRequestFormState = {
  depositorName: string;
  memo: string;
};

const INITIAL_DEPOSIT_REQUEST_FORM: DepositRequestFormState = {
  depositorName: '',
  memo: '',
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
      return '제작 및 출고 준비';
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
      return '입금 확인 요청 접수';
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

  const hasCurrentState = items.some((item) => item.variant === 'current');

  if (!hasCurrentState) {
    items.push({
      key: 'latest-status',
      title: getOrderStatusLabel(order.orderStatus),
      description: '가장 최근에 반영된 주문 상태입니다.',
      occurredAt: order.updatedAt,
      variant: 'current',
      linkUrl: shipment.trackingUrl,
      linkLabel:
        shipment.shipmentStatus === 'SHIPPED' && shipment.trackingNumber ? `운송장 ${shipment.trackingNumber}` : undefined,
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
  const [depositRequestForm, setDepositRequestForm] = useState<DepositRequestFormState>(INITIAL_DEPOSIT_REQUEST_FORM);
  const [depositRequestLoading, setDepositRequestLoading] = useState(false);
  const [depositRequestError, setDepositRequestError] = useState('');
  const [depositRequestResult, setDepositRequestResult] = useState('');

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
      setDepositRequestError('');
      setDepositRequestResult('');
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

  useEffect(() => {
    if (!order) {
      setDepositRequestForm(INITIAL_DEPOSIT_REQUEST_FORM);
      return;
    }

    setDepositRequestForm({
      depositorName: order.deposit.depositorName ?? order.contact.buyerName,
      memo: '',
    });
  }, [order?.orderNumber]);

  const timelineItems = order ? buildTimeline(order, tracking) : [];
  const activeTracking = tracking ?? (order ? buildFallbackTracking(order) : null);
  const depositExpectedAmount = order?.deposit.expectedAmount ?? order?.pricing.finalTotalPrice ?? 0;
  const canRequestDeposit =
    !!order &&
    !lookupLoading &&
    !depositRequestLoading &&
    !['CONFIRMED', 'REQUESTED'].includes(order.deposit.depositStatus) &&
    !['CANCELLED', 'EXPIRED'].includes(order.orderStatus);

  const onLookupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextOrderNumber = normalizeOrderNumber(orderNumberInput);

    if (!nextOrderNumber) {
      setLookupError('주문번호를 입력해 주세요.');
      setOrder(null);
      setTracking(null);
      return;
    }

    setDepositRequestError('');
    setDepositRequestResult('');

    const nextParams = new URLSearchParams();
    nextParams.set('orderNumber', nextOrderNumber);
    setSearchParams(nextParams);

    if (nextOrderNumber === searchOrderNumber) {
      setRefreshKey((value) => value + 1);
    }
  };

  const onRequestDeposit = async () => {
    if (!order) {
      return;
    }

    setDepositRequestLoading(true);
    setDepositRequestError('');
    setDepositRequestResult('');

    const payload: StoreDepositRequestPayload = {
      depositorName: depositRequestForm.depositorName.trim() || undefined,
      memo: depositRequestForm.memo.trim() || undefined,
    };

    try {
      const result = await apiClient.requestDeposit(order.orderNumber, payload);

      setOrder((current) => {
        if (!current || current.orderNumber !== result.orderNumber) {
          return current;
        }

        return {
          ...current,
          orderStatus: current.orderStatus === 'PENDING_PAYMENT' ? 'PAYMENT_REQUESTED' : current.orderStatus,
          deposit: {
            ...current.deposit,
            depositStatus: result.depositStatus,
            requestedAt: result.requestedAt,
            depositorName: payload.depositorName ?? current.deposit.depositorName ?? null,
          },
          updatedAt: result.requestedAt ?? current.updatedAt,
        };
      });

      setDepositRequestResult('입금 확인 요청이 접수되었습니다. 상태가 반영되면 타임라인에서도 확인할 수 있습니다.');
      setRefreshKey((value) => value + 1);
    } catch (caught) {
      setDepositRequestError(caught instanceof Error ? caught.message : '입금 확인 요청 처리 중 오류가 발생했습니다.');
    } finally {
      setDepositRequestLoading(false);
    }
  };

  return (
    <main className="m-page order-lookup-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">Order Lookup</p>
        <h1 className="section-title">주문번호로 상태 확인</h1>
        <p className="section-copy">
          주문 접수 후 받은 주문번호를 입력하면 주문 상태, 입금 진행, 배송 흐름을 한 화면에서 확인할 수 있습니다.
        </p>
      </section>

      <form className="surface-card order-lookup-form" onSubmit={onLookupSubmit}>
        <div className="section-head">
          <div>
            <p className="section-kicker">Find Order</p>
            <h2 className="section-subtitle">주문 조회</h2>
          </div>
          {searchOrderNumber ? (
            <button className="button-text" type="button" onClick={() => setRefreshKey((value) => value + 1)}>
              새로고침
            </button>
          ) : null}
        </div>

        <div className="lookup-input-row">
          <label className="field">
            <span>주문번호</span>
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

        <p className="feedback-copy">
          주문 생성 직후라면 결과 카드의 주문번호를 그대로 붙여 넣으면 됩니다.
        </p>
      </form>

      {lookupError ? (
        <section className="surface-card status-card" role="alert">
          <p className="section-kicker">Unavailable</p>
          <h2 className="section-subtitle">주문을 찾지 못했습니다</h2>
          <p className="feedback-copy is-error">{lookupError}</p>
        </section>
      ) : null}

      {!searchOrderNumber && !order ? (
        <section className="surface-card status-card">
          <p className="section-kicker">Ready</p>
          <h2 className="section-subtitle">조회 준비 완료</h2>
          <p className="feedback-copy">주문번호를 입력하면 최신 주문 상태와 트래킹 정보를 바로 불러옵니다.</p>
        </section>
      ) : null}

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
                  <span>최근 갱신</span>
                  <strong>{formatDateTime(order.updatedAt)}</strong>
                </div>
                <div className="order-summary-row">
                  <span>배송 상태</span>
                  <strong>{getShipmentStatusLabel(activeTracking?.shipmentStatus ?? order.shipment.shipmentStatus)}</strong>
                </div>
              </div>

              <div className="order-lookup-block">
                <h3>수령 정보</h3>
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
              <strong className="detail-price">{formatCurrency(order.pricing.finalTotalPrice)}</strong>
            </div>

            <ul className="order-item-list">
              {order.items.map((item, index) => (
                <li className="order-item-card" key={`${item.productNameSnapshot}-${index}`}>
                  <div>
                    <strong>{item.productNameSnapshot}</strong>
                    {item.optionNameSnapshot && item.optionValueSnapshot ? (
                      <p>
                        {item.optionNameSnapshot} / {item.optionValueSnapshot}
                      </p>
                    ) : null}
                  </div>
                  <div className="order-item-line">
                    <span>
                      {formatCurrency(item.unitPrice)} x {item.quantity}
                    </span>
                    <strong>{formatCurrency(item.lineTotalPrice)}</strong>
                  </div>
                </li>
              ))}
            </ul>

            <div className="order-lookup-block">
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
                  <span>요청 시각</span>
                  <strong>{formatDateTime(order.deposit.requestedAt)}</strong>
                </div>
                <div className="order-summary-row">
                  <span>확인 시각</span>
                  <strong>{formatDateTime(order.deposit.confirmedAt)}</strong>
                </div>
              </div>

              <div className="order-lookup-block">
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
                  <strong>{order.deposit.accountNumber ?? '주문 접수 화면에서 확인'}</strong>
                </div>
              </div>
            </div>

            <div className="order-lookup-block">
              <div className="section-head">
                <div>
                  <p className="section-kicker">Action</p>
                  <h3>입금 확인 요청</h3>
                </div>
                <button className="button button-secondary" type="button" onClick={onRequestDeposit} disabled={!canRequestDeposit}>
                  {depositRequestLoading ? '요청 중...' : '입금확인요청'}
                </button>
              </div>

              <div className="deposit-request-grid">
                <label className="field">
                  <span>입금자명</span>
                  <input
                    value={depositRequestForm.depositorName}
                    onChange={(event) =>
                      setDepositRequestForm((current) => ({
                        ...current,
                        depositorName: event.target.value,
                      }))
                    }
                    placeholder="입금자명을 남기면 확인이 빨라집니다"
                  />
                </label>

                <label className="field">
                  <span>메모</span>
                  <textarea
                    rows={3}
                    value={depositRequestForm.memo}
                    onChange={(event) =>
                      setDepositRequestForm((current) => ({
                        ...current,
                        memo: event.target.value,
                      }))
                    }
                    placeholder="입금 시간이나 전달할 내용을 남겨 주세요"
                  />
                </label>
              </div>

              {depositRequestResult ? (
                <p className="feedback-copy" role="status">
                  {depositRequestResult}
                </p>
              ) : null}
              {depositRequestError ? (
                <p className="feedback-copy is-error" role="alert">
                  {depositRequestError}
                </p>
              ) : null}
              {!canRequestDeposit ? (
                <p className="feedback-copy">
                  {order.deposit.depositStatus === 'CONFIRMED'
                    ? '이미 입금 확인이 완료된 주문입니다.'
                    : order.deposit.depositStatus === 'REQUESTED'
                      ? '입금 확인 요청이 이미 접수되어 있습니다.'
                      : '현재 상태에서는 입금 확인 요청을 보낼 수 없습니다.'}
                </p>
              ) : null}
            </div>
          </section>

          <section className="surface-card order-lookup-summary">
            <div className="section-head">
              <div>
                <p className="section-kicker">Tracking</p>
                <h2 className="section-subtitle">주문 트래킹</h2>
              </div>
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
                  <strong>{getShipmentStatusLabel(activeTracking?.shipmentStatus ?? order.shipment.shipmentStatus)}</strong>
                </div>
                <div className="order-summary-row">
                  <span>택배사</span>
                  <strong>{activeTracking?.courierName ?? '배정 전'}</strong>
                </div>
                <div className="order-summary-row">
                  <span>운송장 번호</span>
                  <strong>{activeTracking?.trackingNumber ?? '등록 전'}</strong>
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
        </>
      ) : null}

      <div className="inline-actions order-inline-actions">
        <Link className="button button-secondary" to="/products">
          상품 둘러보기
        </Link>
      </div>
    </main>
  );
}
