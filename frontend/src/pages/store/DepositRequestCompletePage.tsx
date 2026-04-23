import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { apiClient, StoreOrderLookupResponse } from '../../lib/api';

type DepositRequestCompleteLocationState = {
  orderSummary?: {
    orderNumber: string;
    totalAmount: number;
    firstItemName: string;
    itemCount: number;
  };
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function buildItemSummary(order: StoreOrderLookupResponse): string {
  if (order.items.length === 0) {
    return '주문 상품';
  }

  const firstName = order.items[0]?.productNameSnapshot ?? '주문 상품';
  const additionalCount = Math.max(order.items.length - 1, 0);
  return additionalCount > 0 ? `${firstName} 외 ${additionalCount}건` : firstName;
}

export function DepositRequestCompletePage() {
  const { orderNumber: orderNumberParam } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const locationState = location.state as DepositRequestCompleteLocationState | null;
  const orderSummaryFromState = locationState?.orderSummary ?? null;
  const orderNumber = orderNumberParam ? decodeURIComponent(orderNumberParam).trim().toUpperCase() : '';

  const [order, setOrder] = useState<StoreOrderLookupResponse | null>(null);
  const [loading, setLoading] = useState(!orderSummaryFromState);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderNumber || orderSummaryFromState) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getOrderByNumber(orderNumber);
        if (!cancelled) {
          setOrder(result);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '주문 정보를 불러오지 못했습니다.');
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
  }, [orderNumber, orderSummaryFromState]);

  const summary = useMemo(() => {
    if (orderSummaryFromState) {
      const additionalCount = Math.max(orderSummaryFromState.itemCount - 1, 0);
      return {
        orderNumber: orderSummaryFromState.orderNumber,
        itemLabel:
          additionalCount > 0
            ? `${orderSummaryFromState.firstItemName} 외 ${additionalCount}건`
            : orderSummaryFromState.firstItemName,
        totalAmount: orderSummaryFromState.totalAmount,
      };
    }

    if (order) {
      return {
        orderNumber: order.orderNumber,
        itemLabel: buildItemSummary(order),
        totalAmount: order.pricing.finalTotalPrice,
      };
    }

    return null;
  }, [order, orderSummaryFromState]);

  if (!orderNumber) {
    return (
      <main className="m-page order-lookup-page">
        <section className="surface-card status-card">
          <p className="section-kicker">Invalid</p>
          <h1 className="section-subtitle">주문번호가 필요합니다</h1>
          <div className="inline-actions order-inline-actions">
            <Link className="button button-secondary" to="/products">
              상품 목록으로
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="m-page order-lookup-page deposit-complete-page">
      <section className="surface-card deposit-complete-hero">
        <div className="deposit-complete-icon" aria-hidden="true">
          <span className="deposit-complete-icon-ring deposit-complete-icon-ring-outer" />
          <span className="deposit-complete-icon-ring deposit-complete-icon-ring-inner" />
          <span className="deposit-complete-icon-core">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path d="M5 12.5l5 5L19 8.5" />
            </svg>
          </span>
        </div>
        <h1 className="deposit-complete-title">입금 확인 요청 완료!</h1>
        <p className="deposit-complete-copy">입금 확인은 최대 하루 정도 소요될 수 있습니다.</p>
      </section>

      <section className="surface-card deposit-complete-summary">
        <div className="section-head">
          <h2 className="section-subtitle">주문 내역</h2>
          <span className="deposit-complete-badge">확인중</span>
        </div>

        {loading ? <LoadingScreen mode="inline" title="요약 정보 로딩 중" message="주문 요약 정보를 불러오고 있습니다." /> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && summary ? (
          <div className="deposit-complete-rows">
            <div className="order-summary-row">
              <span>주문 번호</span>
              <strong>{summary.orderNumber}</strong>
            </div>
            <div className="order-summary-row">
              <span>상품명</span>
              <strong>{summary.itemLabel}</strong>
            </div>
            <div className="order-summary-row is-total">
              <span>총 결제 금액</span>
              <strong className="deposit-complete-total">{formatCurrency(summary.totalAmount)}</strong>
            </div>
          </div>
        ) : null}
      </section>

      <div className="deposit-complete-actions">
        <Link className="button" to="/">
          홈으로 돌아가기
        </Link>
        <Link className="button button-secondary" to={`/orders?orderNumber=${encodeURIComponent(orderNumber)}`}>
          주문 상세 보기
        </Link>
      </div>
    </main>
  );
}
