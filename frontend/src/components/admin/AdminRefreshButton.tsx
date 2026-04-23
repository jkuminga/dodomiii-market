type AdminRefreshButtonProps = {
  disabled?: boolean;
  onClick: () => void;
};

function RefreshIcon() {
  return (
    <svg className="admin-refresh-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0 1.2 4.3" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function AdminRefreshButton({ disabled = false, onClick }: AdminRefreshButtonProps) {
  return (
    <button
      className="button button-secondary admin-refresh-button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="새로고침"
      title="새로고침"
      style={{ borderRadius: '1.5rem' }}
    >
      <RefreshIcon />
    </button>
  );
}
