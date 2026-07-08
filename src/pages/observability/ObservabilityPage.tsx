import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Progress,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Activity,
  Database,
  Cpu,
  MemoryStick,
  Clock3,
  Server,
  CircleCheck,
  CircleX,
  HardDrive,
  Boxes,
  Gauge,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import MetricsHistorySection from "./MetricsHistorySection";
import BackupsCard from "./BackupsCard";
import { DataState } from "@/components/ui/DataState";
import { observabilityService, type SystemHealth, type JobStat } from "@/services/observability";
import { fmtUptime, fmtBytes, fmtDateTime, compactNumber, statusColor } from "@/lib/format";
import type { HealthReport, TableStat } from "@/types";

const AUTO_REFRESH_MS = 15000;

export default function ObservabilityPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [tables, setTables] = useState<TableStat[] | null>(null);
  const [system, setSystem] = useState<SystemHealth | null>(null);
  const [jobs, setJobs] = useState<JobStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (opts: { spinner?: boolean } = {}) => {
    const { spinner = true } = opts;
    if (spinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [h, s, sys, j] = await Promise.all([
        observabilityService.health(),
        observabilityService.stats(),
        observabilityService.system().catch(() => null),
        observabilityService.jobs().catch(() => null),
      ]);
      if (!mounted.current) return;
      setHealth(h);
      setTables([...s.tables].sort((a, b) => b.count - a.count));
      setSystem(sys);
      setJobs(j?.jobs || []);
    } catch (e: any) {
      if (!mounted.current) return;
      setError(e?.message || "Failed to load observability data.");
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Lightweight auto-refresh of health only (no loading spinner flash).
  const refreshHealth = useCallback(async () => {
    try {
      const [h, sys, j] = await Promise.all([
        observabilityService.health(),
        observabilityService.system().catch(() => null),
        observabilityService.jobs().catch(() => null),
      ]);
      if (!mounted.current) return;
      setHealth(h);
      if (sys) setSystem(sys);
      if (j) setJobs(j.jobs || []);
    } catch {
      /* errors already toast in the api client; keep last good value */
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const id = setInterval(refreshHealth, AUTO_REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [load, refreshHealth]);

  // % of the HARD heap ceiling (heap_size_limit), not of heapTotal — the latter
  // sits ~90% on a healthy process and reads as a false alarm.
  const heapPct = health
    ? Math.min(100, Math.round((health.memory.heapUsed / Math.max(1, (health.memory as any).heapLimit || health.memory.heapTotal)) * 100))
    : 0;

  return (
    <div>
      <PageHeader
        title="Observability"
        subtitle="Live system health and database footprint"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="flat" startContent={<Server className="h-4 w-4" />} onPress={() => navigate("/observability/workers")}>
              Workers
            </Button>
            <Button size="sm" variant="flat" startContent={<Gauge className="h-4 w-4" />} onPress={() => navigate("/observability/queries")}>
              Consultas DB
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              startContent={<RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />}
              isLoading={refreshing}
              onPress={() => load({ spinner: false })}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <DataState loading={loading} error={error} onRetry={load}>
        {health && tables && (
          <div className="flex flex-col gap-6">
            <MetricsHistorySection />
            <BackupsCard />
            {/* System resources — RAM (memory-leak watch), storage, CPU */}
            {system && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm">
                  <CardBody className="gap-2">
                    <span className="flex items-center gap-2 text-xs font-medium text-default-500"><MemoryStick className="h-4 w-4" /> RAM del proceso (RSS)</span>
                    <span className="text-2xl font-bold text-foreground">{fmtBytes(system.process.rss)}</span>
                    <span className="text-xs text-default-400">Heap {fmtBytes(system.process.heapUsed)} / {fmtBytes(system.process.heapTotal)}</span>
                    <Progress aria-label="heap" size="sm" value={system.process.heapUsedPct ?? 0} color={(system.process.heapUsedPct ?? 0) > 90 ? "danger" : (system.process.heapUsedPct ?? 0) > 75 ? "warning" : "success"} />
                  </CardBody>
                </Card>
                <Card className="shadow-sm">
                  <CardBody className="gap-2">
                    <span className="flex items-center gap-2 text-xs font-medium text-default-500"><Server className="h-4 w-4" /> Memoria del sistema</span>
                    <span className="text-2xl font-bold text-foreground">{system.memory.usedPct}%</span>
                    <span className="text-xs text-default-400">{fmtBytes(system.memory.used)} / {fmtBytes(system.memory.total)}</span>
                    <Progress aria-label="mem" size="sm" value={system.memory.usedPct} color={system.memory.usedPct > 90 ? "danger" : system.memory.usedPct > 75 ? "warning" : "success"} />
                  </CardBody>
                </Card>
                <Card className="shadow-sm">
                  <CardBody className="gap-2">
                    <span className="flex items-center gap-2 text-xs font-medium text-default-500"><HardDrive className="h-4 w-4" /> Almacenamiento</span>
                    {system.disk ? (<>
                      <span className="text-2xl font-bold text-foreground">{system.disk.usedPct ?? 0}%</span>
                      <span className="text-xs text-default-400">{fmtBytes(system.disk.used)} / {fmtBytes(system.disk.total)} · libre {fmtBytes(system.disk.free)}</span>
                      <Progress aria-label="disk" size="sm" value={system.disk.usedPct ?? 0} color={(system.disk.usedPct ?? 0) > 90 ? "danger" : (system.disk.usedPct ?? 0) > 80 ? "warning" : "success"} />
                    </>) : <span className="text-sm text-default-400">No disponible</span>}
                  </CardBody>
                </Card>
                <Card className="shadow-sm">
                  <CardBody className="gap-2">
                    <span className="flex items-center gap-2 text-xs font-medium text-default-500"><Cpu className="h-4 w-4" /> CPU (carga)</span>
                    <span className="text-2xl font-bold text-foreground">{system.cpu.loadPct}%</span>
                    <span className="text-xs text-default-400">load {system.cpu.load1.toFixed(2)} · {system.cpu.cores} núcleos</span>
                    <span className="text-[11px] text-default-400">Uptime proc {fmtUptime(system.process.uptimeSeconds)} · Node {system.process.nodeVersion}</span>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* Background jobs health */}
            {jobs.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="flex items-center gap-2 pb-2">
                  <Boxes className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Trabajos en segundo plano</h2>
                  <Chip size="sm" variant="flat">{jobs.length}</Chip>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="overflow-x-auto">
                  <Table aria-label="Jobs" removeWrapper>
                    <TableHeader>
                      <TableColumn>JOB</TableColumn>
                      <TableColumn>ESTADO</TableColumn>
                      <TableColumn>ÚLTIMA EJECUCIÓN</TableColumn>
                      <TableColumn>DURACIÓN</TableColumn>
                      <TableColumn>EJECUCIONES</TableColumn>
                    </TableHeader>
                    <TableBody items={jobs}>
                      {(j) => (
                        <TableRow key={j.name}>
                          <TableCell className="font-medium">{j.name}</TableCell>
                          <TableCell>
                            <Chip size="sm" variant="flat" color={j.lastStatus === "ok" ? "success" : j.lastStatus === "error" ? "danger" : j.lastStatus === "running" ? "primary" : "default"}>
                              {j.lastStatus || "sin correr"}
                            </Chip>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-default-500">{j.lastRunAt ? fmtDateTime(j.lastRunAt) : "—"}</TableCell>
                          <TableCell className="text-default-500">{j.lastDurationMs != null ? `${j.lastDurationMs} ms` : "—"}</TableCell>
                          <TableCell className="text-default-500">{j.runs}{j.errors ? <span className="text-danger"> · {j.errors} err</span> : null}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </div>
                </CardBody>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Health card */}
              <Card className="shadow-sm lg:col-span-2">
                <CardHeader className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-default-400" />
                    <h2 className="text-sm font-semibold text-foreground">System health</h2>
                  </div>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={statusColor(health.status)}
                    className="capitalize"
                  >
                    {health.status}
                  </Chip>
                </CardHeader>
                <CardBody className="gap-5 pt-2">
                  {/* Top metrics row */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Metric
                      icon={<Clock3 className="h-4 w-4" />}
                      label="Uptime"
                      value={fmtUptime(health.uptimeSeconds)}
                    />
                    <Metric
                      icon={<Server className="h-4 w-4" />}
                      label="Node"
                      value={health.nodeVersion || "—"}
                    />
                    <Metric
                      icon={<MemoryStick className="h-4 w-4" />}
                      label="RSS"
                      value={fmtBytes(health.memory.rss)}
                    />
                  </div>

                  {/* Database */}
                  <div className="rounded-medium border border-default-100 bg-default-50/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-default-400" />
                        <span className="text-sm font-medium text-foreground">Database</span>
                      </div>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={health.database.connected ? "success" : "danger"}
                        startContent={
                          health.database.connected ? (
                            <CircleCheck className="h-3.5 w-3.5" />
                          ) : (
                            <CircleX className="h-3.5 w-3.5" />
                          )
                        }
                      >
                        {health.database.connected ? "Connected" : "Disconnected"}
                      </Chip>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Metric
                        label="Dialect"
                        value={health.database.dialect || "—"}
                        valueClassName="capitalize"
                      />
                      <Metric
                        label="Latency"
                        value={
                          health.database.latencyMs != null
                            ? `${health.database.latencyMs} ms`
                            : "—"
                        }
                      />
                    </div>
                  </div>

                  {/* Memory / heap progress */}
                  <div className="rounded-medium border border-default-100 bg-default-50/50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-default-400" />
                      <span className="text-sm font-medium text-foreground">Heap memory</span>
                    </div>
                    <Progress
                      aria-label="Heap usage"
                      size="md"
                      value={heapPct}
                      color={heapPct >= 90 ? "danger" : heapPct >= 75 ? "warning" : "success"}
                      className="mb-2"
                    />
                    <div className="flex items-center justify-between text-xs text-default-500">
                      <span>
                        {fmtBytes(health.memory.heapUsed)} used of{" "}
                        {fmtBytes(health.memory.heapTotal)}
                      </span>
                      <span className="tabular-nums">{heapPct}%</span>
                    </div>
                  </div>

                  <p className="text-xs text-default-400">
                    Last sampled {fmtDateTime(health.timestamp)}
                  </p>
                </CardBody>
              </Card>

              {/* Stats card */}
              <Card className="shadow-sm">
                <CardHeader className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-default-400" />
                    <h2 className="text-sm font-semibold text-foreground">Table footprint</h2>
                  </div>
                  <Chip size="sm" variant="flat" color="default">
                    {tables.length} tables
                  </Chip>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="overflow-x-auto">
                  <Table
                    removeWrapper
                    aria-label="Database table row counts"
                    selectionMode="none"
                    classNames={{
                      th: "bg-transparent text-default-500 text-xs uppercase tracking-wide",
                      td: "py-2.5",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>TABLE</TableColumn>
                      <TableColumn className="text-right">ROWS</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No table stats.">
                      {tables.map((t) => (
                        <TableRow key={t.name}>
                          <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                          <TableCell className="text-right tabular-nums text-default-600">
                            {compactNumber(t.count)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  valueClassName = "",
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-default-500">
        {icon && <span className="text-default-400">{icon}</span>}
        {label}
      </span>
      <span className={`text-sm font-semibold text-foreground ${valueClassName}`}>{value}</span>
    </div>
  );
}
