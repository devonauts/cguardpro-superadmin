import { get } from "@/lib/api";
import type { Paginated, HealthReport, TableStat, AuditEntry } from "@/types";

export const observabilityService = {
  health: () => get<HealthReport>("/superadmin/observability/health"),
  stats: () => get<{ tables: TableStat[] }>("/superadmin/observability/stats"),
  audit: (params: { action?: string; tenantId?: string; actorUserId?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<AuditEntry>>("/superadmin/audit", params),
};
