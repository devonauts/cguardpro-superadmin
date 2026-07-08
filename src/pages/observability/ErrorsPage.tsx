import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card, CardBody, Button, Chip, Spinner, Switch, Input, Select, SelectItem,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
} from "@heroui/react";
import { Bug, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtDateTime } from "@/lib/format";
import { observabilityService, type ErrorsResult, type ErrorPattern, type ErrorEventRow } from "@/services/observability";

const WINDOWS = [
  { key: "60", label: "Última hora" },
  { key: "360", label: "Últimas 6 h" },
  { key: "1440", label: "Últimas 24 h" },
  { key: "10080", label: "Últimos 7 días" },
];

function statusColor(code: number | null): "default" | "warning" | "danger" {
  if (code === 0) return "danger"; // crash
  if (!code) return "default";
  return code >= 500 ? "danger" : "warning";
}

function Stat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="shadow-sm">
      <CardBody className="gap-1">
        <span className="flex items-center gap-2 text-xs font-medium text-default-500">{icon}{label}</span>
        <span className={`text-2xl font-bold ${tone || "text-foreground"}`}>{value}</span>
        {sub && <span className="text-xs text-default-400">{sub}</span>}
      </CardBody>
    </Card>
  );
}

/** Tiny dependency-free SVG sparkline of the hourly error counts. */
function Sparkline({ series }: { series: { hour: string; count: number }[] }) {
  if (!series.length) return <span className="text-xs text-default-400">Sin datos en la ventana.</span>;
  const max = Math.max(1, ...series.map((s) => s.count));
  const w = 640, h = 60, bw = Math.max(2, Math.floor(w / series.length) - 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
      {series.map((s, i) => {
        const bh = Math.round((s.count / max) * (h - 4));
        return <rect key={i} x={i * (bw + 1)} y={h - bh} width={bw} height={bh}
          className="fill-danger-400" rx={1}><title>{`${s.hour}: ${s.count}`}</title></rect>;
      })}
    </svg>
  );
}

export default function ErrorsPage() {
  const [data, setData] = useState<ErrorsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);
  const [minutes, setMinutes] = useState("1440");
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<ErrorEventRow[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await observabilityService.errors({
        minutes: Number(minutes),
        resolved: onlyUnresolved ? "false" : undefined,
        q: q.trim() || undefined,
      });
      setData(r);
    } catch {
      toast.error("No se pudieron cargar los errores");
    } finally {
      setLoading(false);
    }
  }, [minutes, onlyUnresolved, q]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (auto) timer.current = setInterval(load, 10000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [auto, load]);

  const toggleDetail = async (fp: string) => {
    if (expanded === fp) { setExpanded(null); setDetail([]); return; }
    setExpanded(fp); setDetail([]);
    try {
      const d = await observabilityService.errorDetail(fp);
      setDetail(d.occurrences || []);
    } catch { /* ignore */ }
  };

  const resolve = async (p: ErrorPattern) => {
    try {
      await observabilityService.resolveError(p.fingerprint, !p.resolved);
      toast.success(p.resolved ? "Reabierto" : "Marcado como resuelto");
      load();
    } catch {
      toast.error("No se pudo actualizar");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Errores"
        subtitle="Excepciones y fallos 500 del backend, agrupados por patrón — con atribución de ruta, tenant y request-id."
        actions={
          <div className="flex items-center gap-3">
            <Switch size="sm" isSelected={auto} onValueChange={setAuto}>Auto 10s</Switch>
            <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} onPress={load}>Actualizar</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<AlertTriangle className="h-4 w-4" />} label="Errores (ventana)" value={data ? String(data.total) : "—"} />
        <Stat icon={<ShieldAlert className="h-4 w-4" />} label="Sin resolver" value={data ? String(data.unresolved) : "—"} tone={data && data.unresolved > 0 ? "text-danger" : "text-foreground"} />
        <Stat icon={<Bug className="h-4 w-4" />} label="Patrones" value={data ? String(data.patterns.length) : "—"} />
        <Stat icon={<RefreshCw className="h-4 w-4" />} label="Actualizado" value={data ? new Date(data.timestamp).toLocaleTimeString() : "—"} />
      </div>

      <Card className="shadow-sm">
        <CardBody className="gap-2">
          <span className="text-xs font-medium text-default-500">Tasa de errores por hora</span>
          <Sparkline series={data?.series || []} />
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Select label="Ventana" size="sm" className="max-w-[180px]" selectedKeys={[minutes]}
          onSelectionChange={(k) => setMinutes(String(Array.from(k)[0]))}>
          {WINDOWS.map((w) => <SelectItem key={w.key}>{w.label}</SelectItem>)}
        </Select>
        <Input size="sm" className="max-w-[280px]" placeholder="Buscar en el mensaje…" value={q}
          onValueChange={setQ} startContent={<Search className="h-4 w-4 text-default-400" />} />
        <Switch size="sm" isSelected={onlyUnresolved} onValueChange={setOnlyUnresolved}>Solo sin resolver</Switch>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          <Card className="shadow-sm">
            <CardBody>
              <h3 className="mb-3 text-sm font-semibold">Patrones principales</h3>
              <div className="overflow-x-auto">
              <Table removeWrapper aria-label="Patrones de error">
                <TableHeader>
                  <TableColumn>ERROR</TableColumn>
                  <TableColumn>RUTA</TableColumn>
                  <TableColumn>ESTADO</TableColumn>
                  <TableColumn>OCURR.</TableColumn>
                  <TableColumn>TENANTS</TableColumn>
                  <TableColumn>ÚLTIMA VEZ</TableColumn>
                  <TableColumn> </TableColumn>
                </TableHeader>
                <TableBody emptyContent="Sin errores en la ventana. 🎉">
                  {(data?.patterns || []).map((p) => (
                    <TableRow key={p.fingerprint} className="cursor-pointer" onClick={() => toggleDetail(p.fingerprint)}>
                      <TableCell>
                        <div className="max-w-[360px]">
                          <div className="font-medium text-foreground truncate">{p.name || "Error"}</div>
                          <div className="text-xs text-default-500 truncate">{p.message}</div>
                          {expanded === p.fingerprint && (
                            <pre className="mt-2 max-h-48 overflow-auto rounded bg-default-100 p-2 text-[11px] leading-tight text-default-600 whitespace-pre-wrap">
                              {detail[0]?.route ? `→ ${detail[0].method || ""} ${detail[0].route}\n` : ""}
                              {(detail[0] as any)?.stack || "Cargando…"}
                            </pre>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><span className="text-xs">{p.route || "—"}</span></TableCell>
                      <TableCell><Chip size="sm" color={statusColor(p.statusCode)} variant="flat">{p.statusCode === 0 ? "crash" : p.statusCode}</Chip></TableCell>
                      <TableCell><span className="font-semibold">{p.count}</span></TableCell>
                      <TableCell>{p.tenants || "—"}</TableCell>
                      <TableCell><span className="text-xs text-default-500">{fmtDateTime(p.lastSeen)}</span></TableCell>
                      <TableCell>
                        <Button size="sm" variant={p.resolved ? "flat" : "light"} color={p.resolved ? "success" : "default"}
                          startContent={<CheckCircle2 className="h-4 w-4" />}
                          onClick={(e) => { e.stopPropagation(); resolve(p); }}>
                          {p.resolved ? "Resuelto" : "Resolver"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardBody>
          </Card>

          <Card className="shadow-sm">
            <CardBody>
              <h3 className="mb-3 text-sm font-semibold">Errores recientes</h3>
              <div className="overflow-x-auto">
              <Table removeWrapper aria-label="Errores recientes">
                <TableHeader>
                  <TableColumn>HORA</TableColumn>
                  <TableColumn>ESTADO</TableColumn>
                  <TableColumn>RUTA</TableColumn>
                  <TableColumn>MENSAJE</TableColumn>
                  <TableColumn>TENANT</TableColumn>
                  <TableColumn>REQUEST</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Sin registros.">
                  {(data?.recent || []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell><span className="text-xs">{fmtDateTime(r.createdAt)}</span></TableCell>
                      <TableCell><Chip size="sm" color={statusColor(r.statusCode)} variant="flat">{r.statusCode === 0 ? "crash" : r.statusCode}</Chip></TableCell>
                      <TableCell><span className="text-xs">{r.method} {r.route || "—"}</span></TableCell>
                      <TableCell><span className="text-xs text-default-600 line-clamp-1 max-w-[320px]">{r.message}</span></TableCell>
                      <TableCell><span className="text-[11px] text-default-400">{r.tenantId ? r.tenantId.slice(0, 8) : "—"}</span></TableCell>
                      <TableCell><span className="font-mono text-[11px] text-default-400">{r.requestId || "—"}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
