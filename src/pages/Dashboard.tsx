import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import {
  DollarSign,
  TrendingUp,
  Building2,
  Clock3,
  AlertTriangle,
  Layers,
  Users,
  UserCheck,
  Activity,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataState } from "@/components/ui/DataState";
import { dashboardService } from "@/services/dashboard";
import {
  usd,
  fmtDate,
  fmtRelative,
  compactNumber,
  statusColor,
  billingStatusLabel,
} from "@/lib/format";
import type { DashboardData } from "@/types";
import { TenantStatusChart } from "./dashboard/components/TenantStatusChart";

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardService.load();
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview" />

      <DataState loading={loading} error={error} onRetry={load}>
        {data && (
          <div className="flex flex-col gap-6">
            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard
                label="MRR"
                value={usd(data.billing.mrrCents)}
                icon={<DollarSign className="h-4 w-4" />}
                sub={`Net ${usd(data.billing.netMrrCents)}`}
                accent="success"
              />
              <StatCard
                label="ARR"
                value={usd(data.billing.arrCents)}
                icon={<TrendingUp className="h-4 w-4" />}
                sub="Annual run-rate"
                accent="success"
              />
              <StatCard
                label="Active tenants"
                value={compactNumber(data.tenants.active)}
                icon={<Building2 className="h-4 w-4" />}
                sub={`${compactNumber(data.billing.payingTenants)} paying`}
                accent="primary"
              />
              <StatCard
                label="Trialing"
                value={compactNumber(data.tenants.trialing)}
                icon={<Clock3 className="h-4 w-4" />}
                sub={`${compactNumber(data.billing.trialingTenants)} in trial`}
                accent="primary"
              />
              <StatCard
                label="Past due"
                value={compactNumber(data.tenants.pastDue)}
                icon={<AlertTriangle className="h-4 w-4" />}
                sub="Needs attention"
                accent="warning"
              />
              <StatCard
                label="Total tenants"
                value={compactNumber(data.tenants.total)}
                icon={<Layers className="h-4 w-4" />}
                sub={`${compactNumber(data.tenants.newThisMonth)} new this month`}
                accent="default"
              />
              <StatCard
                label="Active seats"
                value={compactNumber(data.billing.activeSeats)}
                icon={<UserCheck className="h-4 w-4" />}
                sub="Billable seats"
                accent="default"
              />
              <StatCard
                label="Total users"
                value={compactNumber(data.users.total)}
                icon={<Users className="h-4 w-4" />}
                sub={`${compactNumber(data.users.guards)} guards · ${compactNumber(
                  data.users.staff,
                )} staff`}
                accent="default"
              />
            </div>

            {/* Chart + recent activity */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="shadow-sm lg:col-span-2">
                <CardHeader className="flex items-center justify-between pb-0">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Tenants by status
                    </h2>
                    <p className="text-xs text-default-500">
                      Distribution across the lifecycle
                    </p>
                  </div>
                  <Chip size="sm" variant="flat" color="default">
                    {compactNumber(data.tenants.total)} total
                  </Chip>
                </CardHeader>
                <CardBody className="pt-4 text-default-400">
                  <TenantStatusChart tenants={data.tenants} />
                </CardBody>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="flex items-center gap-2 pb-0">
                  <Activity className="h-4 w-4 text-default-400" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Recent activity
                  </h2>
                </CardHeader>
                <CardBody className="pt-3">
                  {data.recentAudit.length === 0 ? (
                    <p className="py-8 text-center text-sm text-default-400">
                      No recent activity.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-default-100">
                      {data.recentAudit.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0"
                        >
                          <span className="text-sm font-medium text-foreground">
                            {entry.action}
                          </span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-default-500">
                              {entry.actorEmail || "system"}
                            </span>
                            <span className="shrink-0 text-xs text-default-400">
                              {fmtRelative(entry.createdAt)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Recent tenants */}
            <Card className="shadow-sm">
              <CardHeader className="flex items-center justify-between pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Recent tenants
                  </h2>
                  <p className="text-xs text-default-500">Latest signups</p>
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <div className="overflow-x-auto">
                <Table
                  removeWrapper
                  aria-label="Recent tenants"
                  selectionMode="none"
                  classNames={{
                    th: "bg-transparent text-default-500 text-xs uppercase tracking-wide",
                    td: "py-3",
                  }}
                >
                  <TableHeader>
                    <TableColumn>NAME</TableColumn>
                    <TableColumn>PLAN</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn className="text-right">SEATS</TableColumn>
                    <TableColumn className="text-right">MRR</TableColumn>
                    <TableColumn>CREATED</TableColumn>
                  </TableHeader>
                  <TableBody emptyContent="No tenants yet.">
                    {data.recentTenants.map((t) => (
                      <TableRow
                        key={t.id}
                        className="cursor-pointer transition-colors hover:bg-default-100"
                        onClick={() => navigate(`/tenants/${t.id}`)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {t.name}
                            </span>
                            {t.email && (
                              <span className="text-xs text-default-400">
                                {t.email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip size="sm" variant="flat" className="capitalize">
                            {t.plan || "—"}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="sm"
                            variant="flat"
                            color={statusColor(
                              t.suspendedAt ? "suspended" : t.billingStatus,
                            )}
                          >
                            {t.suspendedAt
                              ? "Suspended"
                              : billingStatusLabel(t.billingStatus)}
                          </Chip>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {compactNumber(t.seats)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {usd(t.mrrCents)}
                        </TableCell>
                        <TableCell className="text-default-500">
                          {fmtDate(t.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}
