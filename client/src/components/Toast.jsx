import { useApp } from "../context/AppContext";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";
import "./Toast.css";

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card toast-card--${toast.type}`}>
          <div className="toast-card__icon">
            {toast.type === "success" && <CheckCircle size={18} />}
            {toast.type === "warning" && <AlertTriangle size={18} />}
            {toast.type === "info" && <Info size={18} />}
          </div>
          <span className="toast-card__message">{toast.message}</span>
          <button
            className="toast-card__close"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss alert"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
