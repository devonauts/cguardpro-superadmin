import { useNavigate } from "react-router-dom";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import { Bell, PhoneIncoming, MessageSquare, CheckCheck } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import type { SuperadminNotification } from "@/services/notifications";

function iconFor(n: SuperadminNotification) {
  if (n.type.startsWith("call")) return <PhoneIncoming className="h-4 w-4 text-primary" />;
  if (n.type.startsWith("sms")) return <MessageSquare className="h-4 w-4 text-success-600" />;
  return <Bell className="h-4 w-4 text-default-500" />;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationBell() {
  const { unread, recent, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();

  const open = (n: SuperadminNotification) => {
    if (!n.isRead) void markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <button className="relative grid h-9 w-9 place-items-center rounded-full outline-none hover:bg-default-100" aria-label="Notificaciones">
          <Bell className="h-5 w-5 text-default-600" />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Notificaciones" className="w-80 max-w-[90vw]" emptyContent="Sin notificaciones">
        <>
          <DropdownItem key="__header" isReadOnly className="opacity-100" textValue="header">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Notificaciones</span>
              {unread > 0 && (
                <button
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => { e.stopPropagation(); void markAllRead(); }}
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
                </button>
              )}
            </div>
          </DropdownItem>

          {(recent.length ? recent : []).map((n) => (
            <DropdownItem
              key={n.id}
              textValue={n.title}
              onPress={() => open(n)}
              className={n.isRead ? "" : "bg-primary/5"}
            >
              <div className="flex items-start gap-2.5 py-0.5">
                <span className="mt-0.5 shrink-0">{iconFor(n)}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${n.isRead ? "text-default-600" : "font-semibold text-foreground"}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="truncate text-xs text-default-400">{n.body}</p>}
                </div>
                <span className="shrink-0 text-[10px] text-default-400">{timeAgo(n.createdAt)}</span>
              </div>
            </DropdownItem>
          ))}

          <DropdownItem key="__all" textValue="ver todas" onPress={() => navigate("/notifications")} className="text-center">
            <span className="text-xs font-medium text-primary">Ver todas las notificaciones</span>
          </DropdownItem>
        </>
      </DropdownMenu>
    </Dropdown>
  );
}
