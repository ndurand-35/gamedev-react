import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  BellNotification,
  CheckCircle,
  InfoCircle,
  WarningCircle,
  Xmark,
} from "iconoir-react";

import { Alert, useAlerts } from "@/data/hooks/useAlerts";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  Notification,
  NotificationType,
  clearNotifications,
  dismissNotification,
} from "@/data/redux/notificationSlice";

const ALERT_LEVEL_CLASS: Record<Alert["level"], string> = {
  error: "text-error",
  warning: "text-warning",
  info: "text-info",
};

const ALERT_ICON: Record<Alert["level"], React.ReactElement> = {
  error: <WarningCircle width={16} height={16} />,
  warning: <WarningCircle width={16} height={16} />,
  info: <InfoCircle width={16} height={16} />,
};

const NOTIF_LEVEL_CLASS: Record<NotificationType, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
};

const NOTIF_ICON: Record<NotificationType, React.ReactElement> = {
  success: <CheckCircle width={16} height={16} />,
  warning: <WarningCircle width={16} height={16} />,
  error: <WarningCircle width={16} height={16} />,
  info: <InfoCircle width={16} height={16} />,
};

const formatRelativeTime = (createdAt: number): string => {
  const elapsed = Math.max(0, Date.now() - createdAt);
  const sec = Math.round(elapsed / 1000);
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.round(min / 60);
  return `il y a ${hr} h`;
};

export const NotificationCenter = () => {
  const alerts = useAlerts();
  const notifications = useAppSelector((s) => s.notification.list);
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const total = alerts.length;
  const hasError = alerts.some((a) => a.level === "error");

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="fixed top-0 left-1/2 -translate-x-1/2 z-30"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Centre de notifications"
        aria-expanded={open}
        className={
          "flex flex-row items-center gap-2 px-3 py-2 bg-base-300 border-base-content/20 border-b border-x rounded-b text-sm hover:bg-base-200 " +
          (hasError ? "text-error" : "")
        }
      >
        {total > 0 ? (
          <BellNotification width={18} height={18} />
        ) : (
          <Bell width={18} height={18} />
        )}
        {total > 0 && (
          <span
            className={
              "badge badge-sm tabular-nums " +
              (hasError ? "badge-error" : "badge-warning")
            }
          >
            {total}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Centre de notifications"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-80 max-w-[90vw] bg-base-100 border border-base-content/20 shadow-xl rounded-md overflow-hidden flex flex-col max-h-[70vh]"
        >
          <div className="flex flex-row items-center justify-between px-3 py-2 border-b border-base-content/10">
            <span className="text-sm font-semibold">Centre de notifications</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-xs btn-ghost btn-circle"
              aria-label="Fermer"
            >
              <Xmark width={14} height={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            <section className="px-3 py-2">
              <h3 className="text-xs font-semibold opacity-70 mb-1">
                Alertes ({alerts.length})
              </h3>
              {alerts.length === 0 ? (
                <p className="text-xs opacity-60 italic py-1">
                  Aucune alerte active.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-base-content/10">
                  {alerts.map((a) => (
                    <li
                      key={a.id}
                      className="py-2 flex flex-row items-start justify-between gap-2"
                    >
                      <div className="flex flex-row items-start gap-2 flex-1 min-w-0">
                        <span className={ALERT_LEVEL_CLASS[a.level]}>
                          {ALERT_ICON[a.level]}
                        </span>
                        <span
                          className={"text-xs " + ALERT_LEVEL_CLASS[a.level]}
                        >
                          {a.message}
                        </span>
                      </div>
                      {a.link && (
                        <Link
                          to={a.link.to}
                          onClick={() => setOpen(false)}
                          className="btn btn-xs btn-ghost"
                        >
                          {a.link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="px-3 py-2 border-t border-base-content/10">
              <div className="flex flex-row items-center justify-between mb-1">
                <h3 className="text-xs font-semibold opacity-70">
                  Activité ({notifications.length})
                </h3>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => dispatch(clearNotifications())}
                    className="text-xs underline opacity-70 hover:opacity-100"
                  >
                    Effacer
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs opacity-60 italic py-1">
                  Aucune activité récente.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-base-content/10">
                  {[...notifications]
                    .slice()
                    .reverse()
                    .map((n: Notification) => (
                      <li
                        key={n.id}
                        className="py-2 flex flex-row items-start justify-between gap-2"
                      >
                        <div className="flex flex-row items-start gap-2 flex-1 min-w-0">
                          <span className={NOTIF_LEVEL_CLASS[n.type]}>
                            {NOTIF_ICON[n.type]}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs">{n.message}</span>
                            <span className="text-[10px] opacity-50">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Effacer"
                          onClick={() => dispatch(dismissNotification(n.id))}
                          className="btn btn-xs btn-ghost btn-circle"
                        >
                          <Xmark width={12} height={12} />
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
