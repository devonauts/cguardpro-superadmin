import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import {
  ArrowLeft,
  Mail,
  Users,
  CheckCircle2,
  XCircle,
  CreditCard,
  Clock3,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
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
import type { BillingSummary, InvoiceRow } from "@/types";

interface TenantBillingData {
  tenant: { id: string; name: string; email: string | null };
  summary: BillingSummary;
  invoices: InvoiceRow[];
}

export default function TenantBillingDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TenantBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await billingService.tenantDetail(id));
    } catch (e: any) {
      setError(e?.message || "Failed to load tenant billing.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;
  const quote = summary?.quote;

  return (
    <div>
      <PageHeader
        title={data?.tenant.name || "Tenant billing"}
        subtitle="Subscription, quote and invoices"
        actions={
          <Button
            as={Link}
            to="/billing"
            variant="flat"
            size="sm"
            startContent={<ArrowLeft className="h-4 w-4" />}
          >
            Back to billing
          </Button>
        }
      />

      <DataState loading={loading} error={error} onRetry={load}>
        {data && summary && quote && (
          <div className="flex flex-col gap-6">
            {/* Identity + status */}
            <Card className="shadow-sm">
              <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-semibold text-foreground">
                    {data.tenant.name}
                  </span>
                  {data.tenant.email && (
                    <span className="flex items-center gap-1.5 text-sm text-default-500">
                      <Mail className="h-3.5 w-3.5" />
                      {data.tenant.email}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip variant="flat" color={statusColor(summary.status)}>
                    {billingStatusLabel(summary.status)}
                  </Chip>
                  <Chip
                    variant="flat"
                    color={summary.hasSubscription ? "success" : "default"}
                    startContent={
                      summary.hasSubscription ? (
                        <CreditCard className="h-3.5 w-3.5" />
                      ) : undefined
                    }
                  >
                    {summary.hasSubscription ? "Subscription active" : "No subscription"}
                  </Chip>
                  <Chip
                    variant="flat"
                    color={summary.implementationPaid ? "success" : "warning"}
                    startContent={
                      summary.implementationPaid ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {summary.implementationPaid
                      ? "Implementation paid"
                      : "Implementation unpaid"}
                  </Chip>
                </div>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Subscription / trial facts */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <h2 className="text-sm font-semibold text-foreground">Subscription</h2>
                </CardHeader>
                <CardBody className="gap-3 pt-0">
                  <Fact
                    icon={<Users className="h-4 w-4" />}
                    label="Billable seats"
                    value={compactNumber(summary.seats)}
                  />
                  <Fact
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Trial length"
                    value={`${summary.trialDays} days`}
                  />
                  <Fact
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Trial ends"
                    value={
                      summary.trial?.endsAt ? fmtDate(summary.trial.endsAt) : "—"
                    }
                  />
                  <Fact
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Trial status"
                    value={
                      summary.trial?.expired
                        ? "Expired"
                        : summary.trial?.active
                          ? `Active · ${summary.trial.daysLeft} day${summary.trial.daysLeft === 1 ? "" : "s"} left`
                          : "Not in trial"
                    }
                  />
                </CardBody>
              </Card>

              {/* Quote breakdown */}
              <Card className="shadow-sm lg:col-span-2">
                <CardHeader className="pb-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Quote breakdown
                  </h2>
                </CardHeader>
                <CardBody className="pt-0">
                  <dl className="divide-y divide-default-100">
                    <QuoteRow label="Per user" value={usd(quote.perUserCents)} />
                    <QuoteRow
                      label={`Seats × per-user (${compactNumber(quote.seats)})`}
                      value={usd(quote.monthlyCents)}
                    />
                    <QuoteRow
                      label="Platform fee"
                      value={usd(quote.platformFeeCents)}
                    />
                    <QuoteRow
                      label="Monthly (gross)"
                      value={usd(quote.monthlyCents)}
                      strong
                    />
                    <QuoteRow
                      label="Net monthly (after Stripe fees)"
                      value={usd(quote.netMonthlyCents)}
                      muted
                    />
                    <QuoteRow
                      label="Implementation (one-time)"
                      value={usd(quote.implementationCents)}
                    />
                    <QuoteRow
                      label="First charge"
                      value={usd(quote.firstChargeCents)}
                      strong
                    />
                  </dl>
                </CardBody>
              </Card>
            </div>

            {/* Invoices */}
            <Card className="shadow-sm">
              <CardHeader className="flex items-center justify-between pb-2">
                <h2 className="text-sm font-semibold text-foreground">Invoices</h2>
                <Chip size="sm" variant="flat">
                  {compactNumber(data.invoices.length)} total
                </Chip>
              </CardHeader>
              <CardBody className="pt-0">
                {data.invoices.length === 0 ? (
                  <p className="py-8 text-center text-sm text-default-400">
                    No invoices for this tenant.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table
                    removeWrapper
                    aria-label="Tenant invoices"
                    selectionMode="none"
                    classNames={{
                      th: "bg-transparent text-default-500 text-xs uppercase tracking-wide",
                      td: "py-3",
                    }}
                  >
                    <TableHeader>
                      <TableColumn>INVOICE</TableColumn>
                      <TableColumn>CLIENT</TableColumn>
                      <TableColumn>STATUS</TableColumn>
                      <TableColumn className="text-right">SUBTOTAL</TableColumn>
                      <TableColumn className="text-right">TOTAL</TableColumn>
                      <TableColumn>DATE</TableColumn>
                      <TableColumn>DUE</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No invoices.">
                      {data.invoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium text-foreground">
                            {inv.invoiceNumber || "—"}
                          </TableCell>
                          <TableCell className="text-default-500">
                            {inv.clientName || "—"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="sm"
                              variant="flat"
                              color={statusColor(inv.status)}
                            >
                              {inv.status || "—"}
                            </Chip>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-default-500">
                            {usdFromDollars(inv.subtotal)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {usdFromDollars(inv.total)}
                          </TableCell>
                          <TableCell className="text-default-500">
                            {fmtDate(inv.date)}
                          </TableCell>
                          <TableCell className="text-default-500">
                            {fmtDate(inv.dueDate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-default-500">
        <span className="text-default-400">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function QuoteRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
      <dt
        className={
          strong
            ? "text-sm font-semibold text-foreground"
            : muted
              ? "text-sm text-default-400"
              : "text-sm text-default-500"
        }
      >
        {label}
      </dt>
      <dd
        className={
          strong
            ? "text-sm font-semibold tabular-nums text-foreground"
            : muted
              ? "text-sm tabular-nums text-default-400"
              : "text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}
