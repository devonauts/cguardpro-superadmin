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
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { observabilityService } from "@/services/observability";
import { fmtUptime, fmtBytes, fmtDateTime, compactNumber, statusColor } from "@/lib/format";
import type { HealthReport, TableStat } from "@/types";

const AUTO_REFRESH_MS = 15000;

export default function ObservabilityPage() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [tables, setTables] = useState<TableStat[] | null>(null);
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
      const [h, s] = await Promise.all([
        observabilityService.health(),
        observabilityService.stats(),
      ]);
      if (!mounted.current) return;
      setHealth(h);
      setTables([...s.tables].sort((a, b) => b.count - a.count));
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
      const h = await observabilityService.health();
      if (mounted.current) setHealth(h);
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

  const heapPct = health
    ? Math.min(100, Math.round((health.memory.heapUsed / Math.max(1, health.memory.heapTotal)) * 100))
    : 0;

  return (
    <div>
      <PageHeader
        title="Observability"
        subtitle="Live system health and database footprint"
        actions={
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
        }
      />

      <DataState loading={loading} error={error} onRetry={load}>
        {health && tables && (
          <div className="flex flex-col gap-6">
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
