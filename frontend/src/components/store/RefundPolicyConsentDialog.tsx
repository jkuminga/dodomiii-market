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
          <div 
            className="refund-consent-warning"
            style={{
              display: 'flex',
              gap: '6px',
              alignItems: 'flex-start',
              whiteSpace: 'pre-line'
            }}
          >
            <span style={{ fontSize: '1.1rem', lineHeight: '1.4' }}>⚠️</span>
            <span>{REFUND_POLICY_CONSENT_MESSAGE}</span>
          </div>
          <p 
            className="feedback-copy" 
            style={{ 
              wordBreak: 'keep-all', 
              marginTop: '4px',
              color: 'var(--muted)'
            }}
          >
            단, 제품에 하자(불량)이 있거나 오배송 된 경우에는 제품 수령일로부터 7일 이내에 교환 또는 환불 가능합니다.
            <br />
            (자세한 내용은 이용약관 명시)
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
          <span style={{ wordBreak: 'keep-all' }}>
            (필수) 주문제작 안내 및 개인정보 수집·이용에 동의합니다.
          </span>
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
