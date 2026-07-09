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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  ArrowLeft,
  Mail,
  Users,
  CheckCircle2,
  XCircle,
  CreditCard,
  Clock3,
  Download,
  ExternalLink,
  RefreshCw,
  Undo2,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { billingService, type PlatformInvoice } from "@/services/billing";
import {
  usd,
  usdFromDollars,
  fmtDate,
  compactNumber,
  statusColor,
  billingStatusLabel,
} from "@/lib/format";
import type { BillingSummary, InvoiceRow } from "@/types";

const stripeStatusColor = (s: string): "success" | "warning" | "danger" | "default" =>
  s === "paid" ? "success" : s === "open" ? "warning" : s === "uncollectible" ? "danger" : "default";

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

  const [stripeInvoices, setStripeInvoices] = useState<PlatformInvoice[]>([]);
  const [stripeSyncError, setStripeSyncError] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [refundTarget, setRefundTarget] = useState<PlatformInvoice | null>(null);
  const refundModal = useDisclosure();
  const cancelModal = useDisclosure();

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

  const loadStripeInvoices = useCallback(async () => {
    if (!id) return;
    setStripeLoading(true);
    try {
      const res = await billingService.subscriptionInvoices(id);
      setStripeInvoices((res.invoices || []).filter((i) => i.status !== "draft"));
      setStripeSyncError(res.syncError || null);
    } catch (e: any) {
      setStripeSyncError(e?.message || "Failed to load Stripe payments.");
    } finally {
      setStripeLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    loadStripeInvoices();
  }, [load, loadStripeInvoices]);

  const doRefund = async () => {
    if (!id || !refundTarget) return;
    setRefunding(true);
    try {
      const res = await billingService.refundInvoice(id, refundTarget.id);
      toast.success(`Refunded ${usd(res.amountCents)} (${res.refundId})`);
      refundModal.onClose();
      setRefundTarget(null);
      loadStripeInvoices();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  const doCancelSubscription = async (immediately: boolean) => {
    if (!id) return;
    setCanceling(true);
    try {
      const res = await billingService.cancelSubscription(id, immediately);
      toast.success(
        immediately
          ? "Subscription canceled immediately."
          : `Subscription will cancel at period end${res.currentPeriodEnd ? ` (${fmtDate(res.currentPeriodEnd)})` : ""}.`,
      );
      cancelModal.onClose();
      load();
      loadStripeInvoices();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Cancel failed");
    } finally {
      setCanceling(false);
    }
  };

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

            {/* Stripe subscription payments (what WE charged this tenant) */}
            <Card className="shadow-sm">
              <CardHeader className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-foreground">Stripe payments</h2>
                  <Chip size="sm" variant="flat">
                    {compactNumber(stripeInvoices.length)} invoices
                  </Chip>
                </div>
                <div className="flex items-center gap-2">
                  {summary.hasSubscription && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      startContent={<Ban className="h-3.5 w-3.5" />}
                      onPress={cancelModal.onOpen}
                    >
                      Cancel subscription
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="flat"
                    isLoading={stripeLoading}
                    startContent={!stripeLoading ? <RefreshCw className="h-3.5 w-3.5" /> : undefined}
                    onPress={loadStripeInvoices}
                  >
                    Refresh from Stripe
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                {stripeSyncError && (
                  <p className="mb-2 rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-700">
                    Stripe sync warning: {stripeSyncError} (showing stored records)
                  </p>
                )}
                {stripeInvoices.length === 0 ? (
                  <p className="py-8 text-center text-sm text-default-400">
                    No Stripe payments yet — records appear when the tenant activates
                    their subscription or a monthly charge runs.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table
                      removeWrapper
                      aria-label="Stripe subscription invoices"
                      selectionMode="none"
                      classNames={{
                        th: "bg-transparent text-default-500 text-xs uppercase tracking-wide",
                        td: "py-3",
                      }}
                    >
                      <TableHeader>
                        <TableColumn>INVOICE</TableColumn>
                        <TableColumn>STATUS</TableColumn>
                        <TableColumn className="text-right">AMOUNT</TableColumn>
                        <TableColumn>DATE</TableColumn>
                        <TableColumn>DETAIL</TableColumn>
                        <TableColumn className="text-right">ACTIONS</TableColumn>
                      </TableHeader>
                      <TableBody emptyContent="No Stripe payments.">
                        {stripeInvoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium text-foreground">
                              {inv.number || inv.stripeInvoiceId}
                            </TableCell>
                            <TableCell>
                              <Chip size="sm" variant="flat" color={stripeStatusColor(inv.status)}>
                                {inv.status}
                              </Chip>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {usd(inv.status === "paid" ? inv.amountPaidCents : inv.amountDueCents)}
                            </TableCell>
                            <TableCell className="text-default-500">
                              {fmtDate(inv.paidAt || inv.issuedAt)}
                            </TableCell>
                            <TableCell className="max-w-64 truncate text-xs text-default-400">
                              {inv.linesSummary || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {inv.hostedInvoiceUrl && (
                                  <Button
                                    as="a"
                                    href={inv.hostedInvoiceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    size="sm"
                                    variant="light"
                                    isIconOnly
                                    title="Open hosted invoice"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                )}
                                {inv.invoicePdfUrl && (
                                  <Button
                                    as="a"
                                    href={inv.invoicePdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    size="sm"
                                    variant="light"
                                    isIconOnly
                                    title="Download PDF"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                {inv.status === "paid" && inv.amountPaidCents > 0 && (
                                  <Button
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    isIconOnly
                                    title="Refund this payment"
                                    onPress={() => {
                                      setRefundTarget(inv);
                                      refundModal.onOpen();
                                    }}
                                  >
                                    <Undo2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Invoices (the tenant's OWN client invoicing, not Stripe) */}
            <Card className="shadow-sm">
              <CardHeader className="flex items-center justify-between pb-2">
                <h2 className="text-sm font-semibold text-foreground">Client invoices (tenant's own invoicing)</h2>
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

      {/* Refund confirmation */}
      <Modal isOpen={refundModal.isOpen} onOpenChange={refundModal.onOpenChange} size="md">
        <ModalContent>
          <ModalHeader>Refund payment</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Fully refund invoice{" "}
              <span className="font-semibold">{refundTarget?.number || refundTarget?.stripeInvoiceId}</span>{" "}
              for <span className="font-semibold">{usd(refundTarget?.amountPaidCents || 0)}</span>?
              The money is returned to the tenant's card via Stripe. This cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={refundModal.onClose} isDisabled={refunding}>
              Keep payment
            </Button>
            <Button color="danger" onPress={doRefund} isLoading={refunding}>
              Refund {usd(refundTarget?.amountPaidCents || 0)}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel-subscription confirmation */}
      <Modal isOpen={cancelModal.isOpen} onOpenChange={cancelModal.onOpenChange} size="md">
        <ModalContent>
          <ModalHeader>Cancel Stripe subscription</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              This cancels the tenant's REAL Stripe subscription (unlike the billing-status
              override, which only flags the account). Choose when it takes effect:
            </p>
            <ul className="list-disc pl-5 text-sm text-default-500">
              <li><span className="font-medium">At period end</span> — they keep access until the paid period runs out; no more charges.</li>
              <li><span className="font-medium">Immediately</span> — subscription ends now and the account is marked canceled.</li>
            </ul>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={cancelModal.onClose} isDisabled={canceling}>
              Keep subscription
            </Button>
            <Button color="warning" variant="flat" onPress={() => doCancelSubscription(false)} isLoading={canceling}>
              Cancel at period end
            </Button>
            <Button color="danger" onPress={() => doCancelSubscription(true)} isLoading={canceling}>
              Cancel immediately
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
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
