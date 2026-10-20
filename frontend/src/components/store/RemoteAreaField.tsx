import { useId } from 'react';

type RemoteAreaFieldProps = {
  checked: boolean;
  hasSelectedAddress: boolean;
  isJeju: boolean;
  jejuAdditionalFee: number;
  islandAdditionalFee: number;
  onChange: (checked: boolean) => void;
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function RemoteAreaField({
  checked,
  hasSelectedAddress,
  isJeju,
  jejuAdditionalFee,
  islandAdditionalFee,
  onChange,
}: RemoteAreaFieldProps) {
  const descriptionId = useId();
  const disabled = !hasSelectedAddress || isJeju;

  return (
    <section className={`order-remote-area${isJeju ? ' is-jeju' : ''}${disabled ? ' is-disabled' : ''}`} aria-label="도서산간 배송비 선택">
      <div className="order-remote-area-head">
        <label className="order-remote-area-label">
          <input
            className="order-remote-area-checkbox"
            type="checkbox"
            checked={isJeju || checked}
            disabled={disabled}
            aria-describedby={descriptionId}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>도서산간 지역 확인</span>
        </label>

        {isJeju ? (
          <>
            <span className="order-remote-area-pill">
              <span aria-hidden="true">✓</span>
              제주 추가 배송비 {formatCurrency(jejuAdditionalFee)} 자동 적용
            </span>
            <span className="order-remote-area-lock" title="제주 주소에서는 선택을 변경할 수 없습니다" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
          </>
        ) : checked && hasSelectedAddress ? (
          <span className="order-remote-area-pill">
            <span aria-hidden="true">✓</span>
            도서산간 추가 배송비 {formatCurrency(islandAdditionalFee)} 적용
          </span>
        ) : null}
      </div>

      <div className="order-remote-area-note" id={descriptionId}>
        <span className="order-remote-area-info-icon" aria-hidden="true">i</span>
        <div>
          {isJeju ? (
            <>
              <p>입력하신 제주도 배송지를 기준으로 추가 배송비가 자동 계산되었습니다.</p>
            </>
          ) : (
            <>
              <p>{hasSelectedAddress ? '도서산간 배송지 확인' : '주소 입력 후 도서산간 지역 여부를 선택해 주세요.'}</p>
              <small>{!hasSelectedAddress ? '(도서산간 지역인데 선택하지 않으신 경우, 추가 배송비를 별도로 요청드릴 수 있습니다.)' : null}</small>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
