import { useEffect } from "react";
import { CheckCircle, InfoCircle, WarningCircle, Xmark } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  Notification,
  NotificationType,
  hideToast,
} from "@/data/redux/notificationSlice";

const TOAST_TTL_MS = 5000;

// Le toast reste une tuile blanche : seule la pastille d'icône porte le ton.
const TYPE_DOT: Record<NotificationType, string> = {
  success: "bg-[#a9ddb4]",
  warning: "bg-[#ffe08a]",
  error: "bg-[#f4a3a8]",
  info: "bg-role-prod",
};

const TYPE_ICON: Record<NotificationType, React.ReactElement> = {
  success: <CheckCircle width={16} height={16} strokeWidth={2.2} />,
  warning: <WarningCircle width={16} height={16} strokeWidth={2.2} />,
  error: <WarningCircle width={16} height={16} strokeWidth={2.2} />,
  info: <InfoCircle width={16} height={16} strokeWidth={2.2} />,
};

const Toast = ({ notification }: { notification: Notification }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const elapsed = Date.now() - notification.createdAt;
    const remaining = Math.max(0, TOAST_TTL_MS - elapsed);
    // Le toast se masque ; l'entrée reste au journal (centre de notifications).
    const id = setTimeout(() => {
      dispatch(hideToast(notification.id));
    }, remaining);
    return () => clearTimeout(id);
  }, [dispatch, notification.id, notification.createdAt]);

  return (
    <div
      role="alert"
      className="toy-tile flex items-center gap-2.5 py-2 pr-2 pl-2.5 text-sm font-semibold shadow-toy-sm"
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-ink ${TYPE_DOT[notification.type]}`}
      >
        {TYPE_ICON[notification.type]}
      </span>
      <span className="flex-1 leading-snug">{notification.message}</span>
      <button
        type="button"
        aria-label="Fermer"
        className="btn btn-xs btn-circle btn-ghost"
        onClick={() => dispatch(hideToast(notification.id))}
      >
        <Xmark width={14} height={14} />
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const list = useAppSelector((s) => s.notification.list);
  // Seules les entrées récentes et pas encore vues s'affichent en toast : le
  // journal, persisté, contient aussi tout l'historique de la partie.
  const now = Date.now();
  const toasts = list
    .filter((n) => !n.toastDismissed && now - n.createdAt < TOAST_TTL_MS)
    .slice(-5);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-16 right-2 left-2 z-50 flex flex-col gap-2 sm:right-4 sm:left-auto sm:w-full sm:max-w-sm">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((n) => (
          <Toast key={n.id} notification={n} />
        ))}
      </div>
    </div>
  );
};
