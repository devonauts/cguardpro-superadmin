import { get, del, post } from "@/lib/api";
import type { Paginated, HealthReport, TableStat, AuditEntry } from "@/types";

export interface ErrorPattern {
  fingerprint: string;
  count: number;
  name: string | null;
  message: string | null;
  route: string | null;
  statusCode: number | null;
  source: string | null;
  tenants: number;
  resolved: boolean;
  firstSeen: string;
  lastSeen: string;
}
export interface ErrorEventRow {
  id: string;
  fingerprint: string;
  name: string | null;
  message: string | null;
  statusCode: number | null;
  method: string | null;
  route: string | null;
  source: string | null;
  tenantId: string | null;
  userId: string | null;
  ip: string | null;
  requestId: string | null;
  pmInstance: string | null;
  resolved: boolean;
  createdAt: string;
}
export interface ErrorsResult {
  window: number;
  total: number;
  unresolved: number;
  patterns: ErrorPattern[];
  recent: ErrorEventRow[];
  series: { hour: string; count: number }[];
  timestamp: string;
}

export interface SystemHealth {
  process: {
    rss: number; heapUsed: number; heapTotal: number; external: number; arrayBuffers: number;
    heapUsedPct: number | null; uptimeSeconds: number; pid: number;
    pm2Instance: string | null; nodeVersion: string;
  };
  memory: { total: number; free: number; used: number; usedPct: number };
  cpu: { cores: number; load1: number; load5: number; load15: number; loadPct: number };
  disk: { total: number; free: number; used: number; usedPct: number | null } | null;
  host: { platform: string; hostname: string; uptimeSeconds: number };
  timestamp: string;
}

export interface DbPerformance {
  pool: { size?: number; available?: number; using?: number; waiting?: number; max?: number; min?: number } | null;
  dbSize: { tables: number; bytes: number } | null;
  perfSchema: boolean;
  digests: Array<{
    sql_text: string; calls: number; avg_s: number; max_s: number; total_s: number;
    rows_examined: number; last_seen: string;
  }>;
  timestamp: string;
}

export interface JobStat {
  name: string; lastRunAt?: string; lastDurationMs?: number;
  lastStatus?: "ok" | "error" | "running"; lastError?: string | null;
  runs: number; errors: number;
}

export interface SlowQueriesResult {
  thresholdMs: number; totalSlow: number; maxMs: number; captured: number;
  queries: Array<{ sql: string; ms: number; at: string; route?: string | null; method?: string | null; tenantId?: string | null; requestId?: string | null; queryNo?: number }>;
  pid: number; timestamp: string;
}

export interface WorkerSnapshot {
  instance: string;
  pid: number;
  uptimeSeconds: number;
  cpuPct: number;
  mem: { rss: number; heapUsed: number; heapTotal: number; external: number; arrayBuffers: number; other: number };
  heapLimit: number;
  heapSpaces: Array<{ name: string; used: number; total: number }>;
  slow: { totalSlow: number; maxMs: number; captured: number; thresholdMs: number };
  eventLoop?: { meanMs: number; maxMs: number; p99Ms: number };
  at: string;
}

export const observabilityService = {
  health: () => get<HealthReport>("/superadmin/observability/health"),
  stats: () => get<{ tables: TableStat[] }>("/superadmin/observability/stats"),
  audit: (params: { action?: string; actionPrefix?: string; tenantId?: string; actorUserId?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<AuditEntry>>("/superadmin/audit", params),

  system: () => get<SystemHealth>("/superadmin/observability/system"),
  db: () => get<DbPerformance>("/superadmin/observability/db"),
  jobs: () => get<{ jobs: JobStat[]; pid: number; timestamp: string }>("/superadmin/observability/jobs"),
  slowQueries: () => get<SlowQueriesResult>("/superadmin/observability/slow-queries"),
  clearSlowQueries: () => del<{ ok: boolean }>("/superadmin/observability/slow-queries"),
  workers: () => get<{ redis: boolean; workers: WorkerSnapshot[]; timestamp: string }>("/superadmin/observability/workers"),
  errors: (params?: { minutes?: number; limit?: number; resolved?: string; q?: string; source?: string; tenantId?: string }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString() : "";
    return get<ErrorsResult>(`/superadmin/observability/errors${qs}`);
  },
  errorDetail: (fingerprint: string) => get<{ fingerprint: string; count: number; occurrences: ErrorEventRow[] }>(`/superadmin/observability/errors/${fingerprint}`),
  resolveError: (fingerprint: string, resolved: boolean) => post<{ ok: boolean; updated: number }>("/superadmin/observability/errors/resolve", { fingerprint, resolved }),
  systemHistory: (hours = 6) => get<{ hours: number; points: MetricPoint[]; timestamp: string }>(`/superadmin/observability/system/history?hours=${hours}`),
  alerts: () => get<AlertsResult>("/superadmin/observability/alerts"),
  dbTables: () => get<{ tables: DbTable[]; error?: string; timestamp: string }>("/superadmin/observability/db/tables"),
  dbProcessList: () => get<{ processes: DbProcess[]; error?: string; timestamp: string }>("/superadmin/observability/db/processlist"),
  authEvents: (params?: { minutes?: number; event?: string; outcome?: string; ip?: string; email?: string }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString() : "";
    return get<AuthEventsResult>(`/superadmin/observability/auth-events${qs}`);
  },
};

export interface AuthEvent {
  id: string; tenantId: string | null; userId: string | null; email: string | null;
  event: string; outcome: string | null; ip: string | null; userAgent: string | null;
  deviceId: string | null; platform: string | null; detail: string | null; at: string;
}
export interface AuthEventsResult {
  window: number;
  rows: AuthEvent[];
  topFailedIps: { ip: string; count: number }[];
  topFailedEmails: { email: string; count: number }[];
  timestamp: string;
}

export interface DbTable {
  name: string; rowCount: number; dataBytes: number; indexBytes: number; totalBytes: number; freeBytes: number;
}
export interface DbProcess {
  id: number; user: string; host: string; db: string | null; command: string;
  time: number; state: string | null; info: string | null; longRunning: boolean;
}

export interface MetricPoint {
  createdAt: string;
  hostMemPct: number | null;
  heapUsedPct: number | null;
  rss: number | null;
  loadPct: number | null;
  diskPct: number | null;
  dbPoolUsing: number | null;
  dbPoolWaiting: number | null;
  dbPoolMax: number | null;
  slowTotal: number | null;
  slowMax: number | null;
  errorCount: number | null;
  jobErrors: number | null;
}
export interface AlertsResult {
  thresholds: Record<string, number>;
  recent: Array<{ id: string; type: string; title: string; body: string | null; createdAt: string; isRead: boolean }>;
  timestamp: string;
}
