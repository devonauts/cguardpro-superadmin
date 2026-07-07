import { useEffect, useState } from "react";
import { Card, CardBody, Chip, Select, SelectItem } from "@heroui/react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { observabilityService, type MetricPoint, type AlertsResult } from "@/services/observability";

const RANGES = [
  { key: "1", label: "1 h" },
  { key: "6", label: "6 h" },
  { key: "24", label: "24 h" },
  { key: "168", label: "7 días" },
];

type MetricKey = "hostMemPct" | "heapUsedPct" | "loadPct" | "diskPct" | "errorCount" | "dbPoolWaiting";
const METRICS: { key: MetricKey; label: string; unit: string; danger: number }[] = [
  { key: "hostMemPct", label: "RAM host", unit: "%", danger: 92 },
  { key: "heapUsedPct", label: "Heap proceso", unit: "%", danger: 92 },
  { key: "loadPct", label: "Carga CPU", unit: "%", danger: 400 },
  { key: "diskPct", label: "Disco", unit: "%", danger: 90 },
  { key: "errorCount", label: "Errores/min", unit: "", danger: 20 },
  { key: "dbPoolWaiting", label: "Pool en espera", unit: "", danger: 1 },
];

/** Dependency-free area sparkline. */
function Spark({ values, danger }: { values: number[]; danger: number }) {
  if (!values.length) return <div className="h-10 text-xs text-default-400">—</div>;
  const max = Math.max(danger, ...values, 1);
  const w = 240, h = 40;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * (h - 3) - 1}`).join(" ");
  const breached = values[values.length - 1] >= danger;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={pts} fill="none" className={breached ? "stroke-danger" : "stroke-primary"} strokeWidth={1.5} />
    </svg>
  );
}

export default function MetricsHistorySection() {
  const [hours, setHours] = useState("6");
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertsResult | null>(null);

  useEffect(() => {
    let alive = true;
    observabilityService.systemHistory(Number(hours)).then((r) => alive && setPoints(r.points || [])).catch(() => {});
    observabilityService.alerts().then((r) => alive && setAlerts(r)).catch(() => {});
    return () => { alive = false; };
  }, [hours]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4" /> Tendencias</h3>
        <Select size="sm" className="max-w-[130px]" selectedKeys={[hours]} aria-label="Rango"
          onSelectionChange={(k) => setHours(String(Array.from(k)[0]))}>
          {RANGES.map((r) => <SelectItem key={r.key}>{r.label}</SelectItem>)}
        </Select>
      </div>

      {points.length === 0 ? (
        <p className="text-xs text-default-400">Aún sin historial — se registra un punto por minuto. Vuelve en unos minutos.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {METRICS.map((m) => {
            const vals = points.map((p) => Number(p[m.key] ?? 0));
            const last = vals[vals.length - 1] ?? 0;
            const breached = last >= m.danger;
            return (
              <Card key={m.key} className="shadow-sm">
                <CardBody className="gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-default-500">{m.label}</span>
                    <span className={`text-sm font-bold ${breached ? "text-danger" : "text-foreground"}`}>
                      {last}{m.unit}
                    </span>
                  </div>
                  <Spark values={vals} danger={m.danger} />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="shadow-sm">
        <CardBody className="gap-2">
          <span className="flex items-center gap-2 text-xs font-medium text-default-500">
            <AlertTriangle className="h-4 w-4" /> Alertas recientes
          </span>
          {alerts && alerts.recent.length > 0 ? (
            <div className="space-y-1">
              {alerts.recent.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{a.title}</span>
                  <span className="text-default-400">{fmtDateTime(a.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-success">Sin alertas. Todo dentro de los umbrales. ✅</p>
          )}
          {alerts && (
            <div className="mt-1 flex flex-wrap gap-1">
              {Object.entries(alerts.thresholds).map(([k, v]) => (
                <Chip key={k} size="sm" variant="flat" className="text-[10px]">{k}: {v}</Chip>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
