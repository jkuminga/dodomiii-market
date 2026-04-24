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

async function copyToClipboard(value: string): Promise<boolean> {
  if (!value.trim()) {
    return false;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function DepositRequestCompletePage() {
  const { orderNumber: orderNumberParam } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const locationState = location.state as DepositRequestCompleteLocationState | null;
  const orderSummaryFromState = locationState?.orderSummary ?? null;
  const orderNumber = orderNumberParam ? decodeURIComponent(orderNumberParam).trim().toUpperCase() : '';
  const contactPhoneParam = new URLSearchParams(location.search).get('contactPhone')?.trim() ?? '';

  const [order, setOrder] = useState<StoreOrderLookupResponse | null>(null);
  const [loading, setLoading] = useState(!orderSummaryFromState);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  useEffect(() => {
    if (!orderNumber || orderSummaryFromState) {
      return;
    }

    if (!contactPhoneParam) {
      setLoading(false);
      setError('주문번호와 주문 시 입력한 연락처가 필요합니다.');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getOrderByNumber(orderNumber, contactPhoneParam);
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
  }, [contactPhoneParam, orderNumber, orderSummaryFromState]);

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

  useEffect(() => {
    if (!copyMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyMessage('');
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyMessage]);

  const handleCopyOrderNumber = async () => {
    if (!summary) {
      return;
    }

    const copied = await copyToClipboard(summary.orderNumber);
    setCopyMessage(copied ? '주문번호가 복사되었습니다.' : '복사에 실패했습니다.');
  };

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
              <span className="deposit-complete-order-label">
                주문 번호
                <span className="deposit-complete-order-help" aria-label="주문번호 안내" tabIndex={0}>
                  ?
                  <span className="deposit-complete-order-tooltip" role="tooltip">
                    주문번호를 통해 주문조회가 가능합니다.
                  </span>
                </span>
              </span>
              <div className="deposit-complete-order-number">
                <strong>{summary.orderNumber}</strong>
                <button
                  className="deposit-complete-copy-button"
                  type="button"
                  onClick={() => void handleCopyOrderNumber()}
                  aria-label="주문번호 복사"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="8" y="7" width="10" height="12" rx="2" />
                    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                {copyMessage ? (
                  <span className="deposit-complete-copy-message" role="status" aria-live="polite">
                    {copyMessage}
                  </span>
                ) : null}
              </div>
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
