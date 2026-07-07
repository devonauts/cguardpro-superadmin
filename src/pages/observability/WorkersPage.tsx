import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader, Button, Chip, Spinner, Switch, Progress } from "@heroui/react";
import { Cpu, Clock3, RefreshCw, Server, MemoryStick, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fmtBytes, fmtUptime } from "@/lib/format";
import { observabilityService, type WorkerSnapshot } from "@/services/observability";

// Memory-composition segments (sum ≈ RSS). arrayBuffers is a subset of external.
const SEG = [
  { key: "heapUsed", label: "Heap usado", color: "#16a34a" },
  { key: "heapFree", label: "Heap libre", color: "#86efac" },
  { key: "external", label: "External (buffers)", color: "#6366f1" },
  { key: "other", label: "Otro (código/stack)", color: "#94a3b8" },
] as const;

function MemoryBar({ m }: { m: WorkerSnapshot["mem"] }) {
  const heapFree = Math.max(0, m.heapTotal - m.heapUsed);
  const vals: Record<string, number> = { heapUsed: m.heapUsed, heapFree, external: m.external, other: m.other };
  const total = Math.max(1, m.heapUsed + heapFree + m.external + m.other);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {SEG.map((s) => (
          <div key={s.key} style={{ width: `${(vals[s.key] / total) * 100}%`, background: s.color }} title={`${s.label}: ${fmtBytes(vals[s.key])}`} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {SEG.map((s) => (
          <span key={s.key} className="flex items-center justify-between text-[11px] text-default-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}
            </span>
            <span className="font-mono">{fmtBytes(vals[s.key])}</span>
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-default-400">de los cuales ArrayBuffers: {fmtBytes(m.arrayBuffers)}</p>
    </div>
  );
}

function WorkerCard({ w }: { w: WorkerSnapshot }) {
  const heapPct = w.mem.heapTotal ? Math.round((w.mem.heapUsed / w.mem.heapTotal) * 100) : 0;
  const topSpaces = [...w.heapSpaces].sort((a, b) => b.used - a.used).slice(0, 4);
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex items-center justify-between pb-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Server className="h-4 w-4 text-primary" /> Worker {w.instance}
          <span className="text-xs font-normal text-default-400">pid {w.pid}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <Chip size="sm" variant="flat" color={w.cpuPct > 85 ? "danger" : w.cpuPct > 50 ? "warning" : "success"} startContent={<Cpu className="h-3 w-3" />}>{w.cpuPct}%</Chip>
          <Chip size="sm" variant="flat" startContent={<Clock3 className="h-3 w-3" />}>{fmtUptime(w.uptimeSeconds)}</Chip>
        </div>
      </CardHeader>
      <CardBody className="gap-3 pt-0">
        <div className="flex items-end justify-between">
          <div>
            <span className="flex items-center gap-1.5 text-xs text-default-500"><MemoryStick className="h-3.5 w-3.5" /> RSS (RAM total)</span>
            <span className="text-2xl font-bold text-foreground">{fmtBytes(w.mem.rss)}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-default-500">Heap</span>
            <p className="text-sm font-semibold">{fmtBytes(w.mem.heapUsed)} / {fmtBytes(w.mem.heapTotal)}</p>
          </div>
        </div>
        <Progress aria-label="heap" size="sm" value={heapPct} color={heapPct > 90 ? "danger" : heapPct > 75 ? "warning" : "success"} />

        <div>
          <p className="mb-1.5 text-xs font-semibold text-default-600">¿Qué consume la RAM?</p>
          <MemoryBar m={w.mem} />
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-default-600">Espacios del heap V8 (top)</p>
          <div className="flex flex-col gap-0.5">
            {topSpaces.map((s) => (
              <span key={s.name} className="flex items-center justify-between text-[11px] text-default-500">
                <span>{s.name}</span>
                <span className="font-mono">{fmtBytes(s.used)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-divider pt-2 text-[11px] text-default-500">
          <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Consultas lentas: <b>{w.slow.totalSlow}</b> (máx {w.slow.maxMs}ms)</span>
          <span>Límite heap {fmtBytes(w.heapLimit)}</span>
        </div>
        {w.eventLoop && (
          <div className="text-[11px] text-default-500">
            Event-loop lag: <b className={w.eventLoop.p99Ms > 100 ? "text-danger" : w.eventLoop.p99Ms > 40 ? "text-warning-600" : ""}>{w.eventLoop.meanMs}ms</b> media · p99 {w.eventLoop.p99Ms}ms · máx {w.eventLoop.maxMs}ms
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerSnapshot[]>([]);
  const [redis, setRedis] = useState(true);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await observabilityService.workers();
      setWorkers([...res.workers].sort((a, b) => String(a.instance).localeCompare(String(b.instance), undefined, { numeric: true })));
      setRedis(res.redis);
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

  const totalRss = workers.reduce((a, w) => a + w.mem.rss, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Workers (PM2)"
        subtitle="Uso de RAM, CPU y composición de memoria por cada worker del cluster"
        actions={
          <div className="flex items-center gap-3">
            <Switch size="sm" isSelected={auto} onValueChange={setAuto}>Auto 5s</Switch>
            <Button size="sm" variant="flat" startContent={<RefreshCw className="h-4 w-4" />} onPress={load}>Actualizar</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-default-500">
        <Chip size="sm" variant="flat" color={redis ? "success" : "warning"}>{redis ? "Cluster vía Redis" : "Worker único (sin Redis)"}</Chip>
        <span>{workers.length} worker(s) · RAM total {fmtBytes(totalRss)}</span>
      </div>

      {loading && !workers.length ? (
        <div className="flex justify-center py-16"><Spinner color="primary" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {workers.map((w) => <WorkerCard key={w.instance} w={w} />)}
        </div>
      )}

      <p className="text-[11px] text-default-400">
        Cada worker publica su snapshot a Redis cada 10s. RSS subiendo de forma sostenida (sobre todo old_space del heap)
        indica una fuga de memoria. External/ArrayBuffers alto = buffers (subidas, audio, etc.).
      </p>
    </div>
  );
}
