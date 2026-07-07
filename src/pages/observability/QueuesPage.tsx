import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card, CardBody, Button, Chip, Spinner, Switch,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/react";
import { Layers, RefreshCw, RotateCcw, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtDateTime } from "@/lib/format";
import { observabilityService, type QueueStatus } from "@/services/observability";

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card className="shadow-sm">
      <CardBody className="gap-1">
        <span className="text-xs font-medium text-default-500">{label}</span>
        <span className={`text-2xl font-bold ${tone || "text-foreground"}`}>{value}</span>
      </CardBody>
    </Card>
  );
}

export default function QueuesPage() {
  const [data, setData] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await observabilityService.queues()); }
    catch { toast.error("No se pudieron cargar las colas"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (auto) timer.current = setInterval(load, 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [auto, load]);

  const retry = async () => {
    const r = await observabilityService.queuesRetry().catch(() => null);
    if (r) toast.success(`${r.retried} trabajo(s) reencolado(s)`);
    load();
  };
  const drain = async () => {
    const r = await observabilityService.queuesDrain().catch(() => null);
    if (r) toast.success(`${r.removed} trabajo(s) fallido(s) eliminado(s)`);
    load();
  };

  const c = data?.counts;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Colas de trabajo"
        subtitle="Cola BullMQ (Redis) para trabajo asíncrono — reintentos, backoff y cola de fallidos (dead-letter)."
        actions={
          <div className="flex items-center gap-3">
            <Switch size="sm" isSelected={auto} onValueChange={setAuto}>Auto 5s</Switch>
            <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} onPress={load}>Actualizar</Button>
          </div>
        }
      />

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !data?.enabled ? (
        <Card className="shadow-sm">
          <CardBody className="py-10 text-center text-sm text-default-500">
            La cola no está habilitada (falta <code>REDIS_URL</code>) — el trabajo se ejecuta en línea como respaldo.
            {data?.error && <div className="mt-2 text-danger">{data.error}</div>}
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="En espera" value={c?.waiting ?? 0} />
            <Stat label="Activos" value={c?.active ?? 0} tone="text-primary" />
            <Stat label="Completados" value={c?.completed ?? 0} tone="text-success" />
            <Stat label="Fallidos" value={c?.failed ?? 0} tone={c && c.failed > 0 ? "text-danger" : "text-foreground"} />
            <Stat label="Retrasados" value={c?.delayed ?? 0} />
            <Stat label="Pausados" value={c?.paused ?? 0} />
          </div>

          <Card className="shadow-sm">
            <CardBody className="gap-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" /> Trabajos fallidos (dead-letter)</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="flat" color="primary" startContent={<RotateCcw className="h-4 w-4" />} isDisabled={!c?.failed} onPress={retry}>Reintentar todos</Button>
                  <Button size="sm" variant="flat" color="danger" startContent={<Trash2 className="h-4 w-4" />} isDisabled={!c?.failed} onPress={drain}>Vaciar fallidos</Button>
                </div>
              </div>
              <Table removeWrapper aria-label="Trabajos fallidos">
                <TableHeader>
                  <TableColumn>TRABAJO</TableColumn>
                  <TableColumn>INTENTOS</TableColumn>
                  <TableColumn>MOTIVO</TableColumn>
                  <TableColumn>CUÁNDO</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Sin trabajos fallidos. ✅">
                  {(data.failed || []).map((j) => (
                    <TableRow key={j.id}>
                      <TableCell><Chip size="sm" variant="flat">{j.name}</Chip></TableCell>
                      <TableCell>{j.attemptsMade}</TableCell>
                      <TableCell><span className="text-xs text-danger line-clamp-1 max-w-[420px]">{j.failedReason}</span></TableCell>
                      <TableCell><span className="text-xs text-default-500">{j.timestamp ? fmtDateTime(new Date(j.timestamp).toISOString()) : "—"}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
