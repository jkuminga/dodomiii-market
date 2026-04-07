import type { CSSProperties } from 'react';

type AdminFloatingSubmitButtonProps = {
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  label: string;
  success?: boolean;
  successLabel?: string;
  stackIndex?: number;
};

export function AdminFloatingSubmitButton({
  busy = false,
  busyLabel,
  disabled = false,
  label,
  success = false,
  successLabel = '✅저장완료',
  stackIndex = 0,
}: AdminFloatingSubmitButtonProps) {
  const resolvedLabel = success ? successLabel : busy ? busyLabel ?? `${label} 중...` : label;

  return (
    <div
      className="admin-floating-submit-shell"
      style={
        {
          '--admin-floating-submit-index': stackIndex,
        } as CSSProperties
      }
    >
      <button className="admin-floating-submit-button" type="submit" disabled={disabled || busy || success}>
        {busy ? <span className="admin-floating-submit-spinner" aria-hidden="true" /> : null}
        <span>{resolvedLabel}</span>
      </button>
    </div>
  );
}
