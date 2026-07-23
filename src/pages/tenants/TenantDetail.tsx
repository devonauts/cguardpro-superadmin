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
  Select,
  SelectItem,
  Divider,
  useDisclosure,
} from "@heroui/react";
import {
  ArrowLeft,
  Ban,
  LogIn,
  CalendarPlus,
  Download,
  PlayCircle,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { DeleteTenantModal } from "./components/DeleteTenantModal";
import { tenantsService } from "@/services/tenants";
import { plansService } from "@/services/plans";
import type { TenantDetail as TenantDetailType, PlanCatalog } from "@/types";
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
  const [plans, setPlans] = useState<PlanCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const suspendModal = useDisclosure();
  const deleteModal = useDisclosure();
  const trialModal = useDisclosure();

  const [reason, setReason] = useState("");
  const [trialDays, setTrialDays] = useState(14);
  const [acting, setActing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accessing, setAccessing] = useState(false);

  // Enter the tenant's CRM directly (works even with no tenant user online).
  // superadmin & CRM share the same origin, so we drop the CRM's auth keys into
  // localStorage (never a token in the URL) and open the CRM in a new tab.
  const doAccess = async () => {
    if (!tenant) return;
    setAccessing(true);
    try {
      const r = await tenantsService.access(tenant.id);
      localStorage.setItem("authToken", r.token);
      localStorage.setItem("tenantId", r.tenantId);
      // Open on THIS origin (where we just set localStorage) so the CRM tab shares it.
      window.open(`${window.location.origin}/dashboard`, "_blank", "noopener,noreferrer");
      toast.success(`Accediendo al CRM de ${r.tenantName} como ${r.userName}`);
    } catch {
      toast.error("No se pudo acceder al CRM del tenant");
    } finally {
      setAccessing(false);
    }
  };

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

  useEffect(() => {
    plansService
      .list()
      .then((res) => setPlans(res.plans || []))
      .catch(() => setPlans([]));
  }, []);

  const doChangePlan = async (plan: string) => {
    if (!plan || plan === tenant?.plan) return;
    setActing(true);
    try {
      await tenantsService.changePlan(id, plan);
      toast.success(`Plan changed to ${plan}`);
      load();
    } catch {
      /* toast via interceptor */
    } finally {
      setActing(false);
    }
  };

  const doSetBillingStatus = async (status: string) => {
    setActing(true);
    try {
      await tenantsService.setBillingStatus(id, status);
      toast.success(`Billing status set to ${status}`);
      load();
    } catch {
      /* toast via interceptor */
    } finally {
      setActing(false);
    }
  };

  const doToggleImplementation = async (paid: boolean) => {
    setActing(true);
    try {
      await tenantsService.markImplementation(id, paid);
      toast.success(paid ? "Implementation marked paid" : "Implementation marked unpaid");
      load();
    } catch {
      /* toast via interceptor */
    } finally {
      setActing(false);
    }
  };

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

  const doExtendTrial = async () => {
    if (!Number.isFinite(trialDays) || trialDays <= 0) {
      toast.error("Enter a number of days (1 or more).");
      return;
    }
    setActing(true);
    try {
      await tenantsService.extendTrial(id, { days: trialDays });
      toast.success(`Trial extended by ${trialDays} day${trialDays === 1 ? "" : "s"}`);
      trialModal.onClose();
      setTrialDays(14);
      load();
    } catch {
      /* toast via interceptor */
    } finally {
      setActing(false);
    }
  };

  /** Preview the resulting trial end (mirrors the backend: from the later of now
      and the current trial end, so a running trial gains time). */
  const previewTrialEnd = (): Date => {
    const cur = tenant?.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
    const base = cur && cur.getTime() > Date.now() ? cur : new Date();
    return new Date(base.getTime() + (trialDays || 0) * 24 * 60 * 60 * 1000);
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
                  <Button
                    size="sm"
                    color="secondary"
                    variant="solid"
                    startContent={<LogIn className="h-4 w-4" />}
                    isLoading={accessing}
                    onPress={doAccess}
                  >
                    Acceder al CRM
                  </Button>
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
                    color="primary"
                    variant="flat"
                    startContent={<CalendarPlus className="h-4 w-4" />}
                    onPress={trialModal.onOpen}
                  >
                    Extend trial
                  </Button>
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
                <BillingTab
                  tenant={tenant}
                  plans={plans}
                  acting={acting}
                  onChangePlan={doChangePlan}
                  onSetBillingStatus={doSetBillingStatus}
                  onToggleImplementation={doToggleImplementation}
                />
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

      {/* Extend-trial modal */}
      <Modal
        isOpen={trialModal.isOpen}
        onClose={() => {
          if (!acting) {
            setTrialDays(14);
            trialModal.onClose();
          }
        }}
      >
        <ModalContent>
          <ModalHeader>Extend trial</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500">
              Add free-trial days for{" "}
              <span className="font-medium text-foreground">{tenant?.name}</span>.
              A running trial gains the time; an expired trial is re-opened from
              today.
            </p>
            <div className="flex flex-col gap-1 rounded-lg bg-default-100 p-3 text-sm">
              <span className="text-default-500">
                Current trial end:{" "}
                <span className="text-foreground">
                  {tenant?.trialEndsAt ? fmtDate(tenant.trialEndsAt) : "—"}
                </span>
              </span>
              <span className="text-default-500">
                New trial end:{" "}
                <span className="font-medium text-success-600">
                  {fmtDate(previewTrialEnd().toISOString())}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 14, 30, 60, 90].map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={trialDays === d ? "solid" : "flat"}
                  color={trialDays === d ? "primary" : "default"}
                  onPress={() => setTrialDays(d)}
                >
                  +{d}d
                </Button>
              ))}
            </div>
            <Input
              type="number"
              label="Days to add"
              variant="bordered"
              min={1}
              max={3650}
              value={String(trialDays)}
              onValueChange={(v) => setTrialDays(parseInt(v, 10) || 0)}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              isDisabled={acting}
              onPress={() => {
                setTrialDays(14);
                trialModal.onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={acting}
              isDisabled={!Number.isFinite(trialDays) || trialDays <= 0}
              onPress={doExtendTrial}
            >
              Extend trial
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete modal (shared with the tenants list) */}
      <DeleteTenantModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.onClose}
        tenant={tenant ? { id: tenant.id, name: tenant.name } : null}
        onDeleted={() => navigate("/tenants")}
      />
    </div>
  );
}

// ── Billing tab ──────────────────────────────────────────────────────────────
function BillingTab({
  tenant,
  plans,
  acting,
  onChangePlan,
  onSetBillingStatus,
  onToggleImplementation,
}: {
  tenant: TenantDetailType;
  plans: PlanCatalog[];
  acting: boolean;
  onChangePlan: (plan: string) => void;
  onSetBillingStatus: (status: string) => void;
  onToggleImplementation: (paid: boolean) => void;
}) {
  const b = tenant.billing;
  const q = b.quote;
  const seatCap = b.plan?.seatCap ?? null;
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
            <Field
              label="Seats"
              value={seatCap != null ? `${b.seats} / ${seatCap}` : b.seats}
            />
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
          {b.plan?.features && b.plan.features.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-default-500">
                Plan features
              </span>
              <div className="flex flex-wrap gap-1">
                {b.plan.features.map((f) => (
                  <Chip key={f} size="sm" variant="flat">
                    {f}
                  </Chip>
                ))}
              </div>
            </div>
          )}
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

      {/* ───────────── Manage subscription (superadmin overrides) ───────────── */}
      <Card className="shadow-sm lg:col-span-2 border border-primary/30">
        <CardHeader className="text-sm font-semibold">Manage subscription</CardHeader>
        <CardBody className="gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-default-500">
                Plan / tier
              </span>
              <Select
                aria-label="Plan"
                size="sm"
                selectedKeys={tenant.plan ? [tenant.plan] : []}
                isDisabled={acting || plans.length === 0}
                onChange={(e) => onChangePlan(e.target.value)}
              >
                {plans.map((p) => (
                  <SelectItem key={p.key}>
                    {p.name}
                    {p.seatCap != null ? ` · cap ${p.seatCap}` : ""}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-default-500">
                Implementation fee
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={b.implementationPaid ? "solid" : "flat"}
                  color="success"
                  isDisabled={acting || b.implementationPaid}
                  onPress={() => onToggleImplementation(true)}
                >
                  Mark paid
                </Button>
                <Button
                  size="sm"
                  variant={!b.implementationPaid ? "solid" : "flat"}
                  isDisabled={acting || !b.implementationPaid}
                  onPress={() => onToggleImplementation(false)}
                >
                  Mark unpaid
                </Button>
              </div>
            </div>
          </div>

          <Divider />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-default-500">
              Billing status override
            </span>
            <p className="text-xs text-default-400">
              Manual override (does not create/cancel a Stripe subscription).
              Use “Comp active” to grant access to a tenant paying by other means.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                color="success"
                variant="flat"
                startContent={<CheckCircle2 className="h-4 w-4" />}
                isDisabled={acting || b.status === "active"}
                onPress={() => onSetBillingStatus("active")}
              >
                Comp active
              </Button>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                isDisabled={acting || b.status === "trialing"}
                onPress={() => onSetBillingStatus("trialing")}
              >
                Back to trialing
              </Button>
              <Button
                size="sm"
                color="warning"
                variant="flat"
                isDisabled={acting || b.status === "past_due"}
                onPress={() => onSetBillingStatus("past_due")}
              >
                Mark past due
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="flat"
                startContent={<XCircle className="h-4 w-4" />}
                isDisabled={acting || b.status === "canceled"}
                onPress={() => onSetBillingStatus("canceled")}
              >
                Cancel
              </Button>
            </div>
          </div>
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
