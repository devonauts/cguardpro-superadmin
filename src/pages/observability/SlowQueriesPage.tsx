import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card, CardBody, CardHeader, Button, Chip, Spinner, Switch,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/react";
import { Database, Gauge, RefreshCw, Trash2, AlertTriangle, Timer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtBytes, fmtDateTime } from "@/lib/format";
import { observabilityService, type SlowQueriesResult, type DbPerformance } from "@/services/observability";
import DbInspectionSection from "./DbInspectionSection";

function msColor(ms: number): "default" | "warning" | "danger" {
  return ms >= 1000 ? "danger" : ms >= 300 ? "warning" : "default";
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="shadow-sm">
      <CardBody className="gap-1">
        <span className="flex items-center gap-2 text-xs font-medium text-default-500">{icon}{label}</span>
        <span className="text-2xl font-bold text-foreground">{value}</span>
        {sub && <span className="text-xs text-default-400">{sub}</span>}
      </CardBody>
    </Card>
  );
}

export default function SlowQueriesPage() {
  const [slow, setSlow] = useState<SlowQueriesResult | null>(null);
  const [dbp, setDbp] = useState<DbPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        observabilityService.slowQueries(),
        observabilityService.db().catch(() => null),
      ]);
      setSlow(s);
      setDbp(d);
    } catch {
      /* interceptor toasts */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (auto) timer.current = setInterval(load, 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [auto, load]);

  const clear = async () => {
    await observabilityService.clearSlowQueries().catch(() => {});
    toast.success("Buffer de consultas reiniciado");
    load();
  };

  const thr = ((slow?.thresholdMs ?? 100) / 1000).toFixed(2);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Monitor de consultas (DB)"
        subtitle={`Captura toda consulta que tarde ≥ ${thr}s para detectar y corregir cuellos de botella`}
        actions={
          <div className="flex items-center gap-3">
            <Switch size="sm" isSelected={auto} onValueChange={setAuto}>Auto 5s</Switch>
            <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} isLoading={loading} onPress={load}>Actualizar</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Timer className="h-4 w-4" />} label="Umbral" value={`${thr}s`} sub="Consulta lenta" />
        <Stat icon={<AlertTriangle className="h-4 w-4" />} label="Lentas (total)" value={String(slow?.totalSlow ?? 0)} sub="Desde el último arranque" />
        <Stat icon={<Gauge className="h-4 w-4" />} label="Más lenta" value={`${slow?.maxMs ?? 0} ms`} sub="Pico registrado" />
        <Stat icon={<Database className="h-4 w-4" />} label="Tamaño DB" value={fmtBytes(dbp?.dbSize?.bytes)} sub={`${dbp?.dbSize?.tables ?? 0} tablas`} />
      </div>

      {/* Connection pool */}
      {dbp?.pool && (
        <Card className="shadow-sm">
          <CardHeader className="text-sm font-semibold text-foreground">Pool de conexiones</CardHeader>
          <CardBody className="flex flex-row flex-wrap gap-6 text-sm">
            <span>En uso: <b>{dbp.pool.using ?? "—"}</b></span>
            <span>Disponibles: <b>{dbp.pool.available ?? "—"}</b></span>
            <span>En espera: <b className={dbp.pool.waiting ? "text-warning-600" : ""}>{dbp.pool.waiting ?? 0}</b></span>
            <span>Tamaño: <b>{dbp.pool.size ?? "—"}</b> / máx {dbp.pool.max ?? "—"}</span>
          </CardBody>
        </Card>
      )}

      {/* Live captured slow queries */}
      <Card className="shadow-sm">
        <CardHeader className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Consultas lentas capturadas (en vivo)</span>
          <Button size="sm" variant="flat" color="danger" startContent={<Trash2 className="h-4 w-4" />} onPress={clear}>Vaciar</Button>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
          <Table aria-label="Consultas lentas" removeWrapper isHeaderSticky className="max-h-[460px] overflow-auto">
            <TableHeader>
              <TableColumn width={90}>TIEMPO</TableColumn>
              <TableColumn width={100}>DURACIÓN</TableColumn>
              <TableColumn width={200}>RUTA</TableColumn>
              <TableColumn>CONSULTA</TableColumn>
            </TableHeader>
            <TableBody isLoading={loading} loadingContent={<Spinner color="primary" />} emptyContent={`Sin consultas ≥ ${thr}s capturadas en este worker.`} items={slow?.queries || []}>
              {(q) => (
                <TableRow key={`${q.at}-${q.sql.slice(0, 24)}`}>
                  <TableCell className="whitespace-nowrap text-[11px] text-default-500">{new Date(q.at).toLocaleTimeString()}</TableCell>
                  <TableCell><Chip size="sm" variant="flat" color={msColor(q.ms)}>{q.ms} ms</Chip></TableCell>
                  <TableCell>
                    <span className="text-[11px] text-default-500">{q.method || ""} {q.route || "—"}</span>
                    {q.queryNo && q.queryNo > 20 ? <Chip size="sm" variant="flat" color="warning" className="ml-1">N+1? #{q.queryNo}</Chip> : null}
                  </TableCell>
                  <TableCell><code className="block max-w-[640px] truncate text-xs text-default-600" title={q.sql}>{q.sql}</code></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          <p className="mt-2 text-[11px] text-default-400">
            Captura por worker de PM2 (cada uno tiene su propio buffer; ves el del worker que atendió esta petición).
            Configurable con <code>SLOW_QUERY_MS</code>.
          </p>
        </CardBody>
      </Card>

      {/* Aggregate slow patterns (performance_schema) */}
      <Card className="shadow-sm">
        <CardHeader className="text-sm font-semibold text-foreground">Patrones más lentos (performance_schema)</CardHeader>
        <CardBody>
          {dbp && !dbp.perfSchema ? (
            <p className="py-6 text-center text-sm text-default-400">performance_schema deshabilitado en MySQL — no hay agregados disponibles.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table aria-label="Patrones lentos" removeWrapper isHeaderSticky className="max-h-[460px] overflow-auto">
              <TableHeader>
                <TableColumn>CONSULTA (DIGEST)</TableColumn>
                <TableColumn width={80}>LLAMADAS</TableColumn>
                <TableColumn width={90}>PROM</TableColumn>
                <TableColumn width={90}>MÁX</TableColumn>
                <TableColumn width={100}>TOTAL</TableColumn>
                <TableColumn width={110}>FILAS EXAM.</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Sin patrones ≥ 0.1s." items={dbp?.digests || []}>
                {(d) => (
                  <TableRow key={d.sql_text + d.calls}>
                    <TableCell>
                      <code className="block max-w-[420px] truncate text-xs text-default-600" title={d.sql_text}>{d.sql_text}</code>
                      {d.fullScan && <Chip size="sm" variant="flat" color="danger" className="mt-1">Falta índice{d.examineRatio ? ` · exam:env ${d.examineRatio}×` : ""}</Chip>}
                    </TableCell>
                    <TableCell className="text-default-500">{d.calls}</TableCell>
                    <TableCell><Chip size="sm" variant="flat" color={msColor(d.avg_s * 1000)}>{(d.avg_s).toFixed(3)}s</Chip></TableCell>
                    <TableCell className="text-default-500">{(d.max_s).toFixed(3)}s</TableCell>
                    <TableCell className="text-default-500">{(d.total_s).toFixed(1)}s</TableCell>
                    <TableCell className="text-default-500">{Number(d.rows_examined).toLocaleString()}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {slow && <p className="text-[11px] text-default-400">Actualizado {fmtDateTime(slow.timestamp)} · worker pid {slow.pid}</p>}

      <DbInspectionSection />
    </div>
  );
}
