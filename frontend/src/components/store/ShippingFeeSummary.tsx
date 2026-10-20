import type { ShippingFeeBreakdown } from '../../lib/shipping';

type ShippingFeeSummaryProps = {
  breakdown: ShippingFeeBreakdown;
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function ShippingFeeSummary({ breakdown }: ShippingFeeSummaryProps) {
  return (
    <div className="order-shipping-summary">
      <div className="order-summary-row">
        <span>배송비</span>
        <strong>{formatCurrency(breakdown.shippingFee)}</strong>
      </div>

      <div className="order-shipping-breakdown" role="group" aria-label="배송비 세부 내역">
        <div className="order-shipping-breakdown-row">
          <span>기본 배송비</span>
          <span className="order-shipping-breakdown-amount">
            {breakdown.baseShippingDiscounted ? (
              <>
                <em className="order-shipping-free-badge">무료배송</em>
                <del>{formatCurrency(breakdown.originalBaseShippingFee)}</del>
                <strong className="is-discounted">0원</strong>
              </>
            ) : (
              <strong>{formatCurrency(breakdown.baseShippingFee)}</strong>
            )}
          </span>
        </div>

        {breakdown.region !== 'NORMAL' ? (
          <div className="order-shipping-breakdown-row is-additional">
            <span>
              {breakdown.region === 'JEJU' ? '제주도 추가 배송비' : '도서산간 추가 배송비'}
            </span>
            <strong>{breakdown.additionalShippingFee > 0 ? '+' : ''}{formatCurrency(breakdown.additionalShippingFee)}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
