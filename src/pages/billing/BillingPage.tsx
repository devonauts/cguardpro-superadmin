import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tabs,
  Tab,
  Pagination,
  Spinner,
} from "@heroui/react";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Building2,
  Clock3,
  AlertTriangle,
  Users,
  Gauge,
  Tag,
  Search,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataState } from "@/components/ui/DataState";
import { billingService } from "@/services/billing";
import {
  usd,
  usdFromDollars,
  fmtDate,
  compactNumber,
  statusColor,
  billingStatusLabel,
} from "@/lib/format";
import type {
  BillingOverview,
  Paginated,
  TenantBillingRow,
  InvoiceRow,
} from "@/types";
import { MrrByPlanChart, StatusBreakdownChart } from "./components/MrrCharts";

const PAGE_LIMIT = 20;

const BILLING_STATUS_OPTIONS = [
  { key: "", label: "All statuses" },
  { key: "trialing", label: "Trial" },
  { key: "active", label: "Active" },
  { key: "past_due", label: "Past due" },
  { key: "trial_expired", label: "Trial expired" },
  { key: "canceled", label: "Canceled" },
];

const INVOICE_STATUS_OPTIONS = [
  { key: "", label: "All statuses" },
  { key: "Borrador", label: "Borrador" },
  { key: "Pendiente", label: "Pendiente" },
  { key: "Pagado", label: "Pagado" },
  { key: "En mora", label: "En mora" },
  { key: "Rechazado", label: "Rechazado" },
];

/** Debounce a value by `delay` ms. */
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function BillingPage() {
  // ── Overview ────────────────────────────────────────────────────────────
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [ovError, setOvError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setOvLoading(true);
    setOvError(null);
    try {
      setOverview(await billingService.overview());
    } catch (e: any) {
      setOvError(e?.message || "Failed to load billing overview.");
    } finally {
      setOvLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Revenue, subscriptions and invoices across the platform"
      />

      <DataState loading={ovLoading} error={ovError} onRetry={loadOverview}>
        {overview && (
          <div className="flex flex-col gap-6">
            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                label="MRR"
                value={usd(overview.mrrCents)}
                icon={<DollarSign className="h-4 w-4" />}
                sub="Monthly recurring"
                accent="success"
              />
              <StatCard
                label="ARR"
                value={usd(overview.arrCents)}
                icon={<TrendingUp className="h-4 w-4" />}
                sub="Annual run-rate"
                accent="success"
              />
              <StatCard
                label="Net MRR"
                value={usd(overview.netMrrCents)}
                icon={<Wallet className="h-4 w-4" />}
                sub="After Stripe fees"
                accent="success"
              />
              <StatCard
                label="Paying tenants"
                value={compactNumber(overview.payingTenants)}
                icon={<Building2 className="h-4 w-4" />}
                sub="Active subscriptions"
                accent="primary"
              />
              <StatCard
                label="Trialing"
                value={compactNumber(overview.trialingTenants)}
                icon={<Clock3 className="h-4 w-4" />}
                sub="In trial period"
                accent="primary"
              />
              <StatCard
                label="Past due"
                value={compactNumber(overview.pastDueTenants)}
                icon={<AlertTriangle className="h-4 w-4" />}
                sub="Needs attention"
                accent="warning"
              />
              <StatCard
                label="Active seats"
                value={compactNumber(overview.activeSeats)}
                icon={<Users className="h-4 w-4" />}
                sub="Billable seats"
                accent="default"
              />
              <StatCard
                label="Avg seats / tenant"
                value={(overview.avgSeatsPerPayingTenant ?? 0).toLocaleString(
                  "en-US",
                  { maximumFractionDigits: 1 },
                )}
                icon={<Gauge className="h-4 w-4" />}
                sub="Paying tenants"
                accent="default"
              />
              <StatCard
                label="Per-user price"
                value={usd(overview.perUserCents)}
                icon={<Tag className="h-4 w-4" />}
                sub={`+ ${usd(overview.platformFeeCents)} platform fee`}
                accent="default"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader className="pb-0">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      MRR by plan
                    </h2>
                    <p className="text-xs text-default-500">
                      Recurring revenue contribution per plan
                    </p>
                  </div>
                </CardHeader>
                <CardBody className="pt-4 text-default-400">
                  <MrrByPlanChart data={overview.mrrByPlan} />
                </CardBody>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-0">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Tenants by billing status
                    </h2>
                    <p className="text-xs text-default-500">
                      Lifecycle distribution
                    </p>
                  </div>
                </CardHeader>
                <CardBody className="pt-4 text-default-400">
                  <StatusBreakdownChart data={overview.byStatus} />
                </CardBody>
              </Card>
            </div>

            {/* Tabs: tenants / invoices */}
            <Card className="shadow-sm">
              <CardBody>
                <Tabs aria-label="Billing tables" color="primary" variant="underlined">
                  <Tab key="tenants" title="Tenants">
                    <TenantsTab />
                  </Tab>
                  <Tab key="invoices" title="Invoices">
                    <InvoicesTab />
                  </Tab>
                </Tabs>
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}

// ── Tenants tab ─────────────────────────────────────────────────────────────
function TenantsTab() {
  const [search, setSearch] = useState("");
  const [billingStatus, setBillingStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<TenantBillingRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingService.tenants({
        search: debouncedSearch || undefined,
        billingStatus: billingStatus || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, billingStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, billingStatus]);

  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Search tenants"
          placeholder="Search by name…"
          value={search}
          onValueChange={setSearch}
          startContent={<Search className="h-4 w-4 text-default-400" />}
          size="sm"
          className="sm:max-w-xs"
          isClearable
          onClear={() => setSearch("")}
        />
        <Select
          aria-label="Filter by billing status"
          selectedKeys={[billingStatus]}
          onChange={(e) => setBillingStatus(e.target.value)}
          size="sm"
          className="sm:max-w-[200px]"
        >
          {BILLING_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={!loading && rows.length === 0}
        emptyLabel="No tenants match these filters."
        onRetry={load}
      >
        <div className="overflow-x-auto">
        <Table
          removeWrapper
          aria-label="Tenant billing"
          selectionMode="none"
          classNames={{
            th: "bg-transparent text-default-500 text-xs uppercase tracking-wide",
            td: "py-3",
          }}
        >
          <TableHeader>
            <TableColumn>NAME</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn className="text-right">SEATS</TableColumn>
            <TableColumn className="text-right">MONTHLY</TableColumn>
            <TableColumn className="text-right">NET</TableColumn>
            <TableColumn>SUBSCRIPTION</TableColumn>
            <TableColumn>TRIAL</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No tenants.">
            {rows.map((t) => (
              <TableRow key={t.id} className="transition-colors hover:bg-default-100">
                <TableCell>
                  <Link
                    to={`/billing/tenants/${t.id}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={statusColor(t.billingStatus)}>
                    {billingStatusLabel(t.billingStatus)}
                  </Chip>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {compactNumber(t.seats)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {usd(t.monthlyCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-default-500">
                  {usd(t.netMonthlyCents)}
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={t.hasSubscription ? "success" : "default"}
                  >
                    {t.hasSubscription ? "Active" : "None"}
                  </Chip>
                </TableCell>
                <TableCell className="text-default-500">
                  {t.billingStatus === "trialing" && t.trial?.active
                    ? `${t.trial.daysLeft} day${t.trial.daysLeft === 1 ? "" : "s"} left`
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>

        <PaginationBar data={data} page={page} onChange={setPage} loading={loading} />
      </DataState>
    </div>
  );
}

// ── Invoices tab ────────────────────────────────────────────────────────────
function InvoicesTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<InvoiceRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await billingService.invoices({
        search: debouncedSearch || undefined,
        status: status || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const rows = data?.rows ?? [];

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Search invoices"
          placeholder="Search invoice, tenant, client…"
          value={search}
          onValueChange={setSearch}
          startContent={<Search className="h-4 w-4 text-default-400" />}
          size="sm"
          className="sm:max-w-xs"
          isClearable
          onClear={() => setSearch("")}
        />
        <Select
          aria-label="Filter by invoice status"
          selectedKeys={[status]}
          onChange={(e) => setStatus(e.target.value)}
          size="sm"
          className="sm:max-w-[200px]"
        >
          {INVOICE_STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.key}>{o.label}</SelectItem>
          ))}
        </Select>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={!loading && rows.length === 0}
        emptyLabel="No invoices match these filters."
        onRetry={load}
      >
        <div className="overflow-x-auto">
        <Table
          removeWrapper
          aria-label="Invoices"
          selectionMode="none"
          classNames={{
            th: "bg-transparent text-default-500 text-xs uppercase tracking-wide",
            td: "py-3",
          }}
        >
          <TableHeader>
            <TableColumn>INVOICE</TableColumn>
            <TableColumn>TENANT</TableColumn>
            <TableColumn>CLIENT</TableColumn>
            <TableColumn>STATUS</TableColumn>
            <TableColumn className="text-right">TOTAL</TableColumn>
            <TableColumn>DATE</TableColumn>
            <TableColumn>DUE</TableColumn>
          </TableHeader>
          <TableBody emptyContent="No invoices.">
            {rows.map((inv) => (
              <TableRow key={inv.id} className="transition-colors hover:bg-default-100">
                <TableCell>
                  <Link
                    to={`/billing/tenants/${inv.tenantId}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {inv.invoiceNumber || "—"}
                  </Link>
                </TableCell>
                <TableCell className="text-default-500">{inv.tenantName || "—"}</TableCell>
                <TableCell className="text-default-500">{inv.clientName || "—"}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={statusColor(inv.status)}>
                    {inv.status || "—"}
                  </Chip>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {usdFromDollars(inv.total)}
                </TableCell>
                <TableCell className="text-default-500">{fmtDate(inv.date)}</TableCell>
                <TableCell className="text-default-500">{fmtDate(inv.dueDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>

        <PaginationBar data={data} page={page} onChange={setPage} loading={loading} />
      </DataState>
    </div>
  );
}

// ── Shared pagination footer ──────────────────────────────────────────────────
function PaginationBar<T>({
  data,
  page,
  onChange,
  loading,
}: {
  data: Paginated<T> | null;
  page: number;
  onChange: (p: number) => void;
  loading?: boolean;
}) {
  if (!data || data.totalPages <= 1) {
    return data ? (
      <div className="flex items-center justify-end px-1 text-xs text-default-400">
        {compactNumber(data.count)} total
      </div>
    ) : null;
  }
  return (
    <div className="flex flex-col items-center justify-between gap-2 px-1 sm:flex-row">
      <span className="text-xs text-default-400">
        {compactNumber(data.count)} total
        {loading && <Spinner size="sm" className="ml-2 inline-block" />}
      </span>
      <Pagination
        showControls
        size="sm"
        total={data.totalPages}
        page={page}
        onChange={onChange}
      />
    </div>
  );
}
