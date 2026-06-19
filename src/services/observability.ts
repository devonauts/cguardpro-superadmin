import { get, del } from "@/lib/api";
import type { Paginated, HealthReport, TableStat, AuditEntry } from "@/types";

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
  queries: Array<{ sql: string; ms: number; at: string }>;
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
  at: string;
}

export const observabilityService = {
  health: () => get<HealthReport>("/superadmin/observability/health"),
  stats: () => get<{ tables: TableStat[] }>("/superadmin/observability/stats"),
  audit: (params: { action?: string; tenantId?: string; actorUserId?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<AuditEntry>>("/superadmin/audit", params),

  system: () => get<SystemHealth>("/superadmin/observability/system"),
  db: () => get<DbPerformance>("/superadmin/observability/db"),
  jobs: () => get<{ jobs: JobStat[]; pid: number; timestamp: string }>("/superadmin/observability/jobs"),
  slowQueries: () => get<SlowQueriesResult>("/superadmin/observability/slow-queries"),
  clearSlowQueries: () => del<{ ok: boolean }>("/superadmin/observability/slow-queries"),
  workers: () => get<{ redis: boolean; workers: WorkerSnapshot[]; timestamp: string }>("/superadmin/observability/workers"),
};
