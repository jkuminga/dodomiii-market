import { useEffect, useRef, useState } from 'react';

import { REFUND_POLICY_CONSENT_MESSAGE } from '../../lib/refundPolicyConsent';

type RefundPolicyConsentDialogProps = {
  open: boolean;
  busy?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RefundPolicyConsentDialog({
  open,
  busy = false,
  confirmLabel = '동의하고 진행하기',
  onCancel,
  onConfirm,
}: RefundPolicyConsentDialogProps) {
  const [checked, setChecked] = useState(false);
  const checkboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setChecked(false);
      return;
    }

    const focusTimer = window.setTimeout(() => {
      checkboxRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="refund-consent-overlay" role="presentation" onClick={busy ? undefined : onCancel}>
      <section
        className="refund-consent-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-consent-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="refund-consent-body">
          <p className="section-kicker">Order Policy</p>
          <h2 className="section-subtitle" id="refund-consent-title">
            주문제작 안내
          </h2>
          <p className="refund-consent-warning">⚠️ {REFUND_POLICY_CONSENT_MESSAGE}</p>
          <p className="feedback-copy">
            단, 제품에 하자(불량)이 있거나 오배송 된 경우에는 수령 후 7일 이내에 교환이 가능합니다.(자세한 내용은 이용약관 명시)
          </p>
        </div>

        <label className="refund-consent-check">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={checked}
            disabled={busy}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>(필수)위 내용을 확인하였으며, 이에 동의합니다.</span>
        </label>

        <div className="refund-consent-actions">
          <button className="button button-secondary" type="button" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button className="button" type="button" onClick={onConfirm} disabled={!checked || busy}>
            {busy ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
