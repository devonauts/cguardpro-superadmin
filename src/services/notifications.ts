import { get, post, patch, del } from "@/lib/api";

/** A platform notification row (SuperAdmin notification center). */
export interface SuperadminNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  icon: string | null;
  isRead: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface NotificationListResult {
  rows: SuperadminNotification[];
  total: number;
  page: number;
  limit: number;
  unread: number;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
  search?: string;
}

export const notificationsService = {
  list: (q: NotificationQuery = {}) =>
    get<NotificationListResult>("/superadmin/notifications", {
      page: q.page,
      limit: q.limit,
      isRead: q.isRead === undefined ? undefined : String(q.isRead),
      type: q.type || undefined,
      search: q.search || undefined,
    }),
  unreadCount: () => get<{ unread: number }>("/superadmin/notifications/unread-count"),
  markRead: (id: string, isRead = true) =>
    patch<SuperadminNotification>(`/superadmin/notifications/${id}/read`, { isRead }),
  markAllRead: () => post<{ ok: boolean; unread: number }>("/superadmin/notifications/read-all"),
  remove: (id: string) => del<{ ok: boolean }>(`/superadmin/notifications/${id}`),
  clearAll: (onlyRead = false) =>
    del<{ ok: boolean; deleted: number }>("/superadmin/notifications", { onlyRead: String(onlyRead) }),
};

export default notificationsService;
