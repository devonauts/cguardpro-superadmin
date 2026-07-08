import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Button, Chip, Input, Pagination, Spinner, Tooltip,
} from "@heroui/react";
import {
  Bell, PhoneIncoming, MessageSquare, Trash2, Check, CheckCheck, ExternalLink, Search, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { notificationsService, type SuperadminNotification } from "@/services/notifications";
import { useNotifications } from "@/context/NotificationContext";

type ReadFilter = "all" | "unread" | "read";
const PAGE_SIZE = 25;

function typeIcon(t: string) {
  if (t.startsWith("call")) return <PhoneIncoming className="h-4 w-4 text-primary" />;
  if (t.startsWith("sms")) return <MessageSquare className="h-4 w-4 text-success-600" />;
  return <Bell className="h-4 w-4 text-default-500" />;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString();
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { refresh: refreshBell } = useNotifications();

  const [rows, setRows] = useState<SuperadminNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsService.list({
        page,
        limit: PAGE_SIZE,
        isRead: readFilter === "all" ? undefined : readFilter === "read",
        search: search.trim() || undefined,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch {
      /* interceptor toasts */
    } finally {
      setLoading(false);
    }
  }, [page, readFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = useCallback(async () => {
    await load();
    await refreshBell();
  }, [load, refreshBell]);

  const openRow = (n: SuperadminNotification) => {
    if (!n.isRead) notificationsService.markRead(n.id, true).then(sync).catch(() => {});
    if (n.link) navigate(n.link);
  };

  const toggleRead = async (n: SuperadminNotification) => {
    await notificationsService.markRead(n.id, !n.isRead).catch(() => {});
    await sync();
  };

  const remove = async (n: SuperadminNotification) => {
    await notificationsService.remove(n.id).catch(() => {});
    toast.success("Notificación eliminada");
    await sync();
  };

  const markAll = async () => {
    await notificationsService.markAllRead().catch(() => {});
    await sync();
  };

  const clearAll = async () => {
    await notificationsService.clearAll(false).catch(() => {});
    toast.success("Notificaciones eliminadas");
    setPage(1);
    await sync();
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterBtn = (key: ReadFilter, label: string) => (
    <Button
      size="sm"
      variant={readFilter === key ? "solid" : "flat"}
      color={readFilter === key ? "primary" : "default"}
      onPress={() => { setReadFilter(key); setPage(1); }}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Notificaciones"
        subtitle="Centro de notificaciones de la plataforma — clic para ir directo al origen"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {filterBtn("all", "Todas")}
          {filterBtn("unread", "No leídas")}
          {filterBtn("read", "Leídas")}
        </div>
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            className="w-56"
            placeholder="Buscar…"
            value={search}
            onValueChange={(v) => { setSearch(v); setPage(1); }}
            startContent={<Search className="h-4 w-4 text-default-400" />}
            isClearable
            onClear={() => setSearch("")}
          />
          <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} onPress={sync}>
            Actualizar
          </Button>
          <Button size="sm" variant="flat" startContent={<CheckCheck className="h-4 w-4" />} onPress={markAll}>
            Marcar leídas
          </Button>
          <Button size="sm" variant="flat" color="danger" startContent={<Trash2 className="h-4 w-4" />} onPress={clearAll}>
            Vaciar
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
      <Table
        aria-label="Notificaciones"
        removeWrapper
        className="rounded-large border border-default-200 bg-content1 p-1"
        bottomContent={
          pages > 1 ? (
            <div className="flex justify-center py-2">
              <Pagination showControls page={page} total={pages} onChange={setPage} size="sm" />
            </div>
          ) : null
        }
      >
        <TableHeader>
          <TableColumn>TIPO</TableColumn>
          <TableColumn>NOTIFICACIÓN</TableColumn>
          <TableColumn>FECHA</TableColumn>
          <TableColumn>ESTADO</TableColumn>
          <TableColumn align="end">ACCIONES</TableColumn>
        </TableHeader>
        <TableBody
          isLoading={loading}
          loadingContent={<Spinner color="primary" />}
          emptyContent="No hay notificaciones"
          items={rows}
        >
          {(n) => (
            <TableRow key={n.id} className={n.isRead ? "" : "bg-primary/5"}>
              <TableCell>{typeIcon(n.type)}</TableCell>
              <TableCell>
                <button className="flex flex-col items-start text-left" onClick={() => openRow(n)}>
                  <span className={`flex items-center gap-1 text-sm ${n.isRead ? "text-default-600" : "font-semibold text-foreground"}`}>
                    {n.title}
                    {n.link && <ExternalLink className="h-3 w-3 text-default-400" />}
                  </span>
                  {n.body && <span className="text-xs text-default-400">{n.body}</span>}
                </button>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs text-default-500">{fmt(n.createdAt)}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color={n.isRead ? "default" : "primary"}>
                  {n.isRead ? "Leída" : "Nueva"}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Tooltip content={n.isRead ? "Marcar no leída" : "Marcar leída"}>
                    <Button isIconOnly size="sm" variant="light" onPress={() => toggleRead(n)} aria-label="Alternar leída">
                      <Check className={`h-4 w-4 ${n.isRead ? "text-default-400" : "text-success-600"}`} />
                    </Button>
                  </Tooltip>
                  <Tooltip content="Eliminar" color="danger">
                    <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => remove(n)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
