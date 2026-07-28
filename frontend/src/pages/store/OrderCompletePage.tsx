import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

type OrderCompleteLocationState = {
  /** `orderSummary`는 주문 생성 직후 화면에 표시할 주문번호·상품·결제금액 요약 객체다. */
  orderSummary?: {
    orderNumber: string;
    totalAmount: number;
    firstItemName: string;
    itemCount: number;
  };
};

type OrderCompletePageProps = {
  /** `preview`는 주문 생성 없이 완료 화면의 문구와 레이아웃을 확인하는 임시 라우터용 값이다. */
  preview?: boolean;
};

const PREVIEW_ORDER_SUMMARY = {
  orderNumber: 'TEMP-ORDER-0001',
  totalAmount: 0,
  firstItemName: '테스트 상품',
  itemCount: 1,
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (!value.trim() || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** 주문 생성 완료 후 체크 애니메이션과 주문 요약을 보여 주는 전용 완료 화면이다. */
export function OrderCompletePage({ preview = false }: OrderCompletePageProps) {
  const { orderNumber: orderNumberParam } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const locationState = location.state as OrderCompleteLocationState | null;
  const orderNumber = orderNumberParam
    ? decodeURIComponent(orderNumberParam).trim().toUpperCase()
    : preview
      ? PREVIEW_ORDER_SUMMARY.orderNumber
      : '';
  const [copyMessage, setCopyMessage] = useState('');

  const summary = useMemo(() => {
    const stateSummary = locationState?.orderSummary ?? (preview ? PREVIEW_ORDER_SUMMARY : null);
    if (!stateSummary || stateSummary.orderNumber !== orderNumber) {
      return null;
    }

    const additionalCount = Math.max(stateSummary.itemCount - 1, 0);
    return {
      ...stateSummary,
      itemLabel: additionalCount > 0 ? `${stateSummary.firstItemName} 외 ${additionalCount}건` : stateSummary.firstItemName,
    };
  }, [locationState?.orderSummary, orderNumber, preview]);

  useEffect(() => {
    if (!copyMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyMessage(''), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyMessage]);

  const handleCopyOrderNumber = async () => {
    const copied = await copyToClipboard(orderNumber);
    setCopyMessage(copied ? '주문번호가 복사되었습니다.' : '복사에 실패했습니다.');
  };

  if (!orderNumber) {
    return (
      <main className="m-page order-lookup-page">
        <section className="surface-card status-card">
          <p className="section-kicker">Invalid</p>
          <h1 className="section-subtitle">주문번호가 필요합니다</h1>
          <Link className="button button-secondary" to="/products">상품 목록으로</Link>
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
        <h1 className="deposit-complete-title">주문이 완료되었습니다!</h1>
        <p className="deposit-complete-copy">결제 정보는 문자로 전송되었으니 확인해주세요!</p>
      </section>

      <section className="surface-card deposit-complete-summary">
        <div className="section-head">
          <h2 className="section-subtitle">주문 내역</h2>
          <span className="deposit-complete-badge">주문 완료</span>
        </div>

        {summary ? (
          <div className="deposit-complete-rows">
            <div className="order-summary-row">
              <span className="deposit-complete-order-label">주문 번호</span>
              <div className="deposit-complete-order-number">
                <strong>{summary.orderNumber}</strong>
                <button className="deposit-complete-copy-button" type="button" onClick={() => void handleCopyOrderNumber()} aria-label="주문번호 복사">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="8" y="7" width="10" height="12" rx="2" />
                    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                {copyMessage ? <span className="deposit-complete-copy-message" role="status" aria-live="polite">{copyMessage}</span> : null}
              </div>
            </div>
            <div className="order-summary-row"><span>상품명</span><strong>{summary.itemLabel}</strong></div>
            <div className="order-summary-row is-total"><span>총 결제 금액</span><strong className="deposit-complete-total">{formatCurrency(summary.totalAmount)}</strong></div>
          </div>
        ) : (
          <p className="feedback-copy">주문이 정상적으로 접수되었습니다. 주문번호를 보관해 주세요.</p>
        )}
      </section>

      <div className="deposit-complete-actions">
        <Link className="button" to="/">홈으로 돌아가기</Link>
        <Link className="button button-secondary" to={`/orders?orderNumber=${encodeURIComponent(orderNumber)}`}>주문 상세 보기</Link>
      </div>
    </main>
  );
}
