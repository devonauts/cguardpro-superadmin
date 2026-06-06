import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Input,
  useDisclosure,
} from "@heroui/react";
import {
  ArrowLeft,
  Ban,
  Download,
  PlayCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { tenantsService } from "@/services/tenants";
import type { TenantDetail as TenantDetailType } from "@/types";
import {
  usd,
  fmtDate,
  fmtDateTime,
  statusColor,
  billingStatusLabel,
} from "@/lib/format";

/** Derived lifecycle status for the header chip. */
function lifecycle(t: TenantDetailType): { label: string; status: string } {
  if (t.suspendedAt) return { label: "Suspended", status: "suspended" };
  return { label: billingStatusLabel(t.billingStatus), status: t.billingStatus };
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-default-500">
        {label}
      </span>
      <span className="text-sm text-foreground break-words">
        {value || "—"}
      </span>
    </div>
  );
}

export default function TenantDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<TenantDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const suspendModal = useDisclosure();
  const deleteModal = useDisclosure();

  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [acting, setActing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tenantsService.detail(id);
      setTenant(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const doSuspend = async () => {
    if (!reason.trim()) {
      toast.error("A reason is required to suspend.");
      return;
    }
    setActing(true);
    try {
      await tenantsService.suspend(id, reason.trim());
      toast.success("Tenant suspended");
      suspendModal.onClose();
      setReason("");
      load();
    } catch {
      /* toast via interceptor */
    } finally {
      setActing(false);
    }
  };

  const doReactivate = async () => {
    setActing(true);
    try {
      await tenantsService.reactivate(id);
      toast.success("Tenant reactivated");
      load();
    } catch {
      /* toast via interceptor */
    } finally {
      setActing(false);
    }
  };

  const doDelete = async () => {
    if (confirmText.trim().toUpperCase() !== "DELETE") return;
    setActing(true);
    try {
      const res = await tenantsService.remove(id);
      toast.success(
        `Tenant deleted (${res.recordsDeleted ?? 0} records affected)`,
      );
      deleteModal.onClose();
      setConfirmText("");
      navigate("/tenants");
    } catch {
      /* toast via interceptor */
    } finally {
      setActing(false);
    }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const payload = await tenantsService.export(id);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = (tenant?.name || "tenant").replace(/[^a-z0-9]+/gi, "-");
      a.href = url;
      a.download = `tenant-${name}-${id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      /* toast via interceptor */
    } finally {
      setExporting(false);
    }
  };

  const life = tenant ? lifecycle(tenant) : null;
  const suspended = !!tenant?.suspendedAt;

  return (
    <div>
      <div className="mb-4">
        <Button
          as={Link}
          to="/tenants"
          size="sm"
          variant="light"
          startContent={<ArrowLeft className="h-4 w-4" />}
        >
          Tenants
        </Button>
      </div>

      <DataState loading={loading} error={error} onRetry={load}>
        {tenant && (
          <>
            <PageHeader
              title={tenant.name}
              subtitle={tenant.url || tenant.email || undefined}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {life && (
                    <Chip
                      variant="flat"
                      color={statusColor(life.status)}
                      className="mr-1"
                    >
                      {life.label}
                    </Chip>
                  )}
                  {suspended ? (
                    <Button
                      size="sm"
                      color="success"
                      variant="flat"
                      startContent={<PlayCircle className="h-4 w-4" />}
                      isLoading={acting}
                      onPress={doReactivate}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      color="warning"
                      variant="flat"
                      startContent={<Ban className="h-4 w-4" />}
                      onPress={suspendModal.onOpen}
                    >
                      Suspend
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Download className="h-4 w-4" />}
                    isLoading={exporting}
                    onPress={doExport}
                  >
                    Export
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    startContent={<Trash2 className="h-4 w-4" />}
                    onPress={deleteModal.onOpen}
                  >
                    Delete
                  </Button>
                </div>
              }
            />

            {suspended && tenant.suspensionReason && (
              <Card className="mb-4 border border-danger/40 bg-danger/5 shadow-none">
                <CardBody className="text-sm text-danger-600">
                  <span className="font-medium">Suspended:</span>{" "}
                  {tenant.suspensionReason}
                  {tenant.suspendedAt && (
                    <span className="text-default-500">
                      {" "}
                      · {fmtDateTime(tenant.suspendedAt)}
                    </span>
                  )}
                </CardBody>
              </Card>
            )}

            <Tabs aria-label="Tenant sections" variant="underlined">
              {/* ───────────── Overview ───────────── */}
              <Tab key="overview" title="Overview">
                <Card className="shadow-sm">
                  <CardBody>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Business title" value={tenant.businessTitle} />
                      <Field label="Email" value={tenant.email} />
                      <Field label="Phone" value={tenant.phone} />
                      <Field label="Address" value={tenant.address} />
                      <Field label="City" value={tenant.city} />
                      <Field label="Country" value={tenant.country} />
                      <Field label="Tax number" value={tenant.taxNumber} />
                      <Field
                        label="Website"
                        value={tenant.website}
                      />
                      <Field label="URL" value={tenant.url} />
                      <Field
                        label="Plan"
                        value={
                          <span className="capitalize">{tenant.plan || "—"}</span>
                        }
                      />
                      <Field label="Timezone" value={tenant.timezone} />
                      <Field
                        label="Created"
                        value={fmtDate(tenant.createdAt)}
                      />
                      <Field
                        label="Stripe customer"
                        value={
                          tenant.stripeCustomerId ? (
                            <code className="text-xs">
                              {tenant.stripeCustomerId}
                            </code>
                          ) : null
                        }
                      />
                      <Field
                        label="Stripe subscription"
                        value={
                          tenant.stripeSubscriptionId ? (
                            <code className="text-xs">
                              {tenant.stripeSubscriptionId}
                            </code>
                          ) : null
                        }
                      />
                    </div>
                  </CardBody>
                </Card>
              </Tab>

              {/* ───────────── Billing ───────────── */}
              <Tab key="billing" title="Billing">
                <BillingTab tenant={tenant} />
              </Tab>

              {/* ───────────── Data ───────────── */}
              <Tab key="data" title="Data">
                <DataTab counts={tenant.counts} />
              </Tab>
            </Tabs>
          </>
        )}
      </DataState>

      {/* Suspend modal */}
      <Modal
        isOpen={suspendModal.isOpen}
        onClose={() => {
          if (!acting) {
            setReason("");
            suspendModal.onClose();
          }
        }}
      >
        <ModalContent>
          <ModalHeader>Suspend tenant</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500">
              Suspending blocks access for this tenant. Provide a reason for the
              audit log.
            </p>
            <Textarea
              label="Reason"
              isRequired
              variant="bordered"
              value={reason}
              onValueChange={setReason}
              minRows={3}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              isDisabled={acting}
              onPress={() => {
                setReason("");
                suspendModal.onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              color="warning"
              isLoading={acting}
              isDisabled={!reason.trim()}
              onPress={doSuspend}
            >
              Suspend
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => {
          if (!acting) {
            setConfirmText("");
            deleteModal.onClose();
          }
        }}
      >
        <ModalContent>
          <ModalHeader className="text-danger">Delete tenant</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500">
              This soft-deletes <span className="font-medium">{tenant?.name}</span>{" "}
              and its data. Type{" "}
              <span className="font-mono font-semibold text-danger">DELETE</span>{" "}
              to confirm.
            </p>
            <Input
              aria-label="Type DELETE to confirm"
              placeholder="DELETE"
              variant="bordered"
              value={confirmText}
              onValueChange={setConfirmText}
              autoFocus
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              isDisabled={acting}
              onPress={() => {
                setConfirmText("");
                deleteModal.onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={acting}
              isDisabled={confirmText.trim().toUpperCase() !== "DELETE"}
              onPress={doDelete}
            >
              Delete tenant
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ── Billing tab ──────────────────────────────────────────────────────────────
function BillingTab({ tenant }: { tenant: TenantDetailType }) {
  const b = tenant.billing;
  const q = b.quote;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader className="text-sm font-semibold">Status</CardHeader>
        <CardBody className="gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Billing status"
              value={
                <Chip
                  size="sm"
                  variant="flat"
                  color={statusColor(b.status)}
                >
                  {billingStatusLabel(b.status)}
                </Chip>
              }
            />
            <Field
              label="Trial days left"
              value={
                b.trial?.active
                  ? `${b.trial.daysLeft} day${b.trial.daysLeft === 1 ? "" : "s"}`
                  : b.trial?.expired
                    ? "Expired"
                    : "—"
              }
            />
            <Field label="Seats" value={b.seats} />
            <Field label="Trial length" value={`${b.trialDays} days`} />
            <Field
              label="Subscription"
              value={b.hasSubscription ? "Active" : "None"}
            />
            <Field
              label="Implementation"
              value={b.implementationPaid ? "Paid" : "Unpaid"}
            />
            {tenant.trialEndsAt && (
              <Field label="Trial ends" value={fmtDate(tenant.trialEndsAt)} />
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="text-sm font-semibold">
          Monthly quote ({q.seats} seat{q.seats === 1 ? "" : "s"})
        </CardHeader>
        <CardBody className="gap-2 text-sm">
          <QuoteLine label="Per user" value={usd(q.perUserCents)} sub="× seats" />
          <QuoteLine label="Platform fee" value={usd(q.platformFeeCents)} />
          <div className="my-1 border-t border-default-200" />
          <QuoteLine label="Monthly (gross)" value={usd(q.monthlyCents)} bold />
          <QuoteLine
            label="Monthly (net)"
            value={usd(q.netMonthlyCents)}
            muted
          />
        </CardBody>
      </Card>
    </div>
  );
}

function QuoteLine({
  label,
  value,
  sub,
  bold,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-default-400" : "text-default-500"}>
        {label}
        {sub && <span className="ml-1 text-xs text-default-400">{sub}</span>}
      </span>
      <span
        className={
          bold
            ? "font-semibold text-foreground"
            : muted
              ? "text-default-400"
              : "text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

// ── Data tab ─────────────────────────────────────────────────────────────────
function DataTab({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardBody className="py-10 text-center text-sm text-default-400">
          No associated records.
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map(([model, n]) => (
        <Card key={model} className="shadow-sm">
          <CardBody className="gap-1">
            <span className="text-2xl font-semibold text-foreground">
              {n.toLocaleString("en-US")}
            </span>
            <span className="text-xs text-default-500 capitalize">
              {model.replace(/([a-z])([A-Z])/g, "$1 $2")}
            </span>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
