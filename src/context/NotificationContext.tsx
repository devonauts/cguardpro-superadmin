import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSocket } from "@/lib/socket";
import { notificationsService, type SuperadminNotification } from "@/services/notifications";

interface NotificationContextValue {
  unread: number;
  recent: SuperadminNotification[];
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const RECENT_LIMIT = 8;

/**
 * Live platform-notification state for the bell + sidebar badge. Loads recent
 * rows + unread count and keeps them current over the websocket
 * ('superadmin:notification' on create, 'superadmin:notification:update' on
 * count change). The full CRUD table (NotificationsPage) uses the service
 * directly and calls refresh() to resync this provider.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const [recent, setRecent] = useState<SuperadminNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsService.list({ page: 1, limit: RECENT_LIMIT });
      setRecent(res.rows);
      setUnread(res.unread);
    } catch {
      /* interceptor toasts */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Live updates.
  useEffect(() => {
    const s = getSocket();
    const onNew = (evt: any) => {
      const n: SuperadminNotification | undefined = evt?.notification;
      if (!n) return;
      setRecent((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, RECENT_LIMIT));
      setUnread((u) => u + 1);
    };
    const onCount = (evt: any) => {
      if (typeof evt?.unread === "number") setUnread(evt.unread);
    };
    s.on("superadmin:notification", onNew);
    s.on("superadmin:notification:update", onCount);
    return () => {
      s.off("superadmin:notification", onNew);
      s.off("superadmin:notification:update", onCount);
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    setRecent((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await notificationsService.markRead(id, true);
    } catch {
      /* ignore — refresh will reconcile */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setRecent((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      await notificationsService.markAllRead();
    } catch {
      /* ignore */
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setRecent((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationsService.remove(id);
    } finally {
      void refresh();
    }
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ unread, recent, loading, refresh, markRead, markAllRead, remove }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within <NotificationProvider>");
  return ctx;
}
