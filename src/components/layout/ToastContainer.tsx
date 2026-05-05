import { useEffect } from "react";
import { CheckCircle, InfoCircle, WarningCircle, Xmark } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  Notification,
  NotificationType,
  dismissNotification,
} from "@/data/redux/notificationSlice";

const TOAST_TTL_MS = 5000;

const TYPE_CLASS: Record<NotificationType, string> = {
  success: "alert-success",
  warning: "alert-warning",
  error: "alert-error",
  info: "alert-info",
};

const TYPE_ICON: Record<NotificationType, React.ReactElement> = {
  success: <CheckCircle width={18} height={18} />,
  warning: <WarningCircle width={18} height={18} />,
  error: <WarningCircle width={18} height={18} />,
  info: <InfoCircle width={18} height={18} />,
};

const Toast = ({ notification }: { notification: Notification }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const elapsed = Date.now() - notification.createdAt;
    const remaining = Math.max(0, TOAST_TTL_MS - elapsed);
    const id = setTimeout(() => {
      dispatch(dismissNotification(notification.id));
    }, remaining);
    return () => clearTimeout(id);
  }, [dispatch, notification.id, notification.createdAt]);

  return (
    <div
      role="alert"
      className={
        "alert shadow-lg pr-2 py-2 text-sm gap-2 " +
        TYPE_CLASS[notification.type]
      }
    >
      {TYPE_ICON[notification.type]}
      <span className="flex-1">{notification.message}</span>
      <button
        type="button"
        aria-label="Fermer"
        className="btn btn-xs btn-circle btn-ghost"
        onClick={() => dispatch(dismissNotification(notification.id))}
      >
        <Xmark width={14} height={14} />
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const list = useAppSelector((s) => s.notification.list);
  if (list.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {list.slice(-5).map((n) => (
          <Toast key={n.id} notification={n} />
        ))}
      </div>
    </div>
  );
};
