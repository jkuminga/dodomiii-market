import { AdminToast } from '../../pages/admin/adminUtils';

type AdminToastRegionProps = {
  toasts: AdminToast[];
  onDismiss: (toastId: number) => void;
};

export function AdminToastRegion({ toasts, onDismiss }: AdminToastRegionProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="admin-toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`admin-toast is-${toast.tone}`} role="status">
          <p>{toast.message}</p>
          <button type="button" className="admin-toast-close" onClick={() => onDismiss(toast.id)} aria-label="알림 닫기">
            닫기
          </button>
        </div>
      ))}
    </div>
  );
}
