import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import {
  Save,
  PlugZap,
  Database,
  Server,
  Info,
  Webhook,
  RefreshCw,
  Copy,
  Wallet,
  ExternalLink,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { fmtDateTime } from "@/lib/format";
import { twilioService } from "@/services/twilio";
import type {
  TwilioSettingsMasked,
  TwilioSettingsUpdate,
  TwilioIncomingNumber,
  TwilioBalance,
} from "@/services/twilio";

const TWILIO_BILLING_URL = "https://console.twilio.com/us1/billing/manage-billing/billing-overview";
const TWILIO_AUTORECHARGE_URL = "https://console.twilio.com/us1/billing/manage-billing/auto-recharge";
const LOW_BALANCE = 5; // USD — warn below this

interface Draft {
  accountSid: string;
  authToken: string;
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
  phoneNumber: string;
  messagingServiceSid: string;
}

const EMPTY_DRAFT: Draft = {
  accountSid: "",
  authToken: "",
  apiKeySid: "",
  apiKeySecret: "",
  twimlAppSid: "",
  phoneNumber: "",
  messagingServiceSid: "",
};

/** Seed the draft from the saved config. Non-secret fields prefill; secrets
 *  (authToken, apiKeySecret) stay blank by design. */
function draftFrom(s: TwilioSettingsMasked): Draft {
  return {
    accountSid: s.accountSid || "",
    authToken: "",
    apiKeySid: s.apiKeySid || "",
    apiKeySecret: "",
    twimlAppSid: s.twimlAppSid || "",
    phoneNumber: s.phoneNumber || "",
    messagingServiceSid: s.messagingServiceSid || "",
  };
}

/** Build the PUT body: changed non-secret fields plus secret fields ONLY when
 *  the user typed something this session. */
function diff(
  saved: TwilioSettingsMasked,
  draft: Draft,
): TwilioSettingsUpdate {
  const patch: TwilioSettingsUpdate = {};
  if (draft.accountSid !== (saved.accountSid || ""))
    patch.accountSid = draft.accountSid;
  if (draft.apiKeySid !== (saved.apiKeySid || ""))
    patch.apiKeySid = draft.apiKeySid;
  if (draft.twimlAppSid !== (saved.twimlAppSid || ""))
    patch.twimlAppSid = draft.twimlAppSid;
  if (draft.phoneNumber !== (saved.phoneNumber || ""))
    patch.phoneNumber = draft.phoneNumber;
  if (draft.messagingServiceSid !== (saved.messagingServiceSid || ""))
    patch.messagingServiceSid = draft.messagingServiceSid;
  if (draft.authToken.trim()) patch.authToken = draft.authToken.trim();
  if (draft.apiKeySecret.trim())
    patch.apiKeySecret = draft.apiKeySecret.trim();
  return patch;
}

export default function TwilioSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<TwilioSettingsMasked | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [numbers, setNumbers] = useState<TwilioIncomingNumber[]>([]);
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [configuringSid, setConfiguringSid] = useState<string | null>(null);

  const [balance, setBalance] = useState<TwilioBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      setBalance(await twilioService.balance());
    } catch {
      /* toast via interceptor */
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const copyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copiada");
    } catch {
      toast.error("No se pudo copiar");
    }
  }, []);

  const hydrate = useCallback((s: TwilioSettingsMasked) => {
    setSettings(s);
    setDraft(draftFrom(s));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      hydrate(await twilioService.settings.get());
    } catch (e: any) {
      setError(e?.message || "Failed to load Twilio settings");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  const loadNumbers = useCallback(async () => {
    setNumbersLoading(true);
    try {
      const res = await twilioService.numbers.list();
      setNumbers(res.numbers || []);
    } catch {
      /* toast via interceptor */
    } finally {
      setNumbersLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadBalance();
  }, [load, loadBalance]);

  const dirty = useMemo(() => {
    if (!settings) return false;
    return Object.keys(diff(settings, draft)).length > 0;
  }, [settings, draft]);

  /** Persist any unsaved edits. Returns false if the save failed. */
  const persist = async (): Promise<boolean> => {
    if (!settings) return false;
    const body = diff(settings, draft);
    if (!Object.keys(body).length) return true; // nothing to persist
    setSaving(true);
    try {
      hydrate(await twilioService.settings.save(body));
      toast.success("Twilio settings saved");
      return true;
    } catch {
      /* error toast via interceptor */
      return false;
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!settings) return;
    if (!Object.keys(diff(settings, draft)).length) {
      toast.info("No changes to save");
      return;
    }
    await persist();
  };

  const onTest = async () => {
    // Test validates the SAVED config, so persist unsaved edits first — otherwise
    // it would test stale/empty credentials and look like a failure.
    if (dirty && !(await persist())) return;
    setTesting(true);
    try {
      const res = await twilioService.settings.test();
      if (res.ok) {
        toast.success(
          `Connected: ${res.friendlyName || res.accountSid || "account"}${
            res.status ? ` (${res.status})` : ""
          }`,
        );
      } else {
        toast.error(res.error || "Connection failed");
      }
    } catch {
      /* toast via interceptor */
    } finally {
      setTesting(false);
    }
  };

  const onConfigure = async (n: TwilioIncomingNumber) => {
    setConfiguringSid(n.sid);
    try {
      const res = await twilioService.numbers.configure({ phoneSid: n.sid });
      if (res.ok) {
        toast.success(`Webhooks configured for ${n.phoneNumber}`);
        loadNumbers();
      } else {
        toast.error(res.error || "Could not configure webhooks");
      }
    } catch {
      /* toast via interceptor */
    } finally {
      setConfiguringSid(null);
    }
  };

  const authPlaceholder = settings?.authTokenConfigured
    ? `•••• ${settings.authTokenLast4 ?? "????"} (saved — leave blank to keep)`
    : "Account auth token";
  const apiSecretPlaceholder = settings?.apiKeySecretConfigured
    ? `•••• ${settings.apiKeySecretLast4 ?? "????"} (saved — leave blank to keep)`
    : "API key secret";

  return (
    <div>
      <PageHeader
        title="Twilio"
        subtitle="Platform phone center — SMS & in-browser voice"
        actions={
          <Button
            color="primary"
            startContent={<Save className="h-4 w-4" />}
            isLoading={saving}
            isDisabled={!dirty || loading}
            onPress={onSave}
          >
            Save changes
          </Button>
        }
      />

      <DataState loading={loading} error={error} onRetry={load}>
        {settings && (
          <div className="flex flex-col gap-4">
            {/* Saldo / funding — Twilio has no add-funds API, so we show balance +
                status and deep-link to billing. */}
            <Card className="shadow-sm">
              <CardHeader className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wallet className="h-4 w-4" /> Saldo Twilio
                </span>
                <Button isIconOnly size="sm" variant="light" aria-label="Actualizar saldo" isLoading={balanceLoading} onPress={loadBalance}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardBody className="gap-3">
                {balance?.ok ? (
                  <>
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <span className="text-2xl font-bold text-foreground">
                          {balance.currency} {balance.balance?.toFixed(2)}
                        </span>
                        <p className="text-xs text-default-500">Saldo disponible en la cuenta</p>
                      </div>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={balance.status === "active" ? "success" : balance.status === "suspended" ? "danger" : "default"}
                      >
                        {balance.status === "active" ? "Activa" : balance.status === "suspended" ? "Suspendida" : balance.status}
                      </Chip>
                    </div>

                    {balance.status === "suspended" && (
                      <div className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>La cuenta está <b>suspendida</b> por falta de fondos. Recarga el saldo para reactivar llamadas y SMS.</span>
                      </div>
                    )}
                    {balance.status === "active" && (balance.balance ?? 0) < LOW_BALANCE && (
                      <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>Saldo bajo. Recarga pronto o activa la auto-recarga para evitar una suspensión.</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-default-500">
                    {balanceLoading ? "Cargando saldo…" : balance?.error || "Guarda las credenciales de Twilio para ver el saldo."}
                  </p>
                )}

                <p className="text-[11px] text-default-400">
                  Twilio no permite agregar fondos por API; la recarga se hace en su portal (un clic abajo). Activa la
                  auto-recarga para que nunca se suspenda.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    color="primary"
                    startContent={<ExternalLink className="h-4 w-4" />}
                    onPress={() => window.open(TWILIO_BILLING_URL, "_blank", "noopener")}
                  >
                    Recargar saldo
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<ExternalLink className="h-4 w-4" />}
                    onPress={() => window.open(TWILIO_AUTORECHARGE_URL, "_blank", "noopener")}
                  >
                    Configurar auto-recarga
                  </Button>
                  <Button
                    size="sm"
                    variant="light"
                    startContent={<BarChart3 className="h-4 w-4" />}
                    onPress={() => navigate("/phone/analytics")}
                  >
                    Ver analítica
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Source banner */}
            <Card className="shadow-sm">
              <CardBody className="gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Chip
                    size="sm"
                    variant="flat"
                    color={settings.source === "db" ? "success" : "warning"}
                    startContent={
                      settings.source === "db" ? (
                        <Database className="h-3.5 w-3.5" />
                      ) : (
                        <Server className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {settings.source === "db"
                      ? "Using saved credentials"
                      : "Using env vars"}
                  </Chip>
                  {settings.updatedAt && (
                    <span className="text-xs text-default-400">
                      Updated {fmtDateTime(settings.updatedAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-default-200 bg-default-50 p-3 text-xs text-default-500">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-default-400" />
                  <span>
                    This is a <span className="font-medium">platform-level</span>{" "}
                    phone center. One Twilio number is shared by all superadmins;
                    inbound calls ring every registered superadmin browser
                    (shared client identity <code>superadmin</code>).
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* Credentials form */}
            <Card className="shadow-sm">
              <CardHeader className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  Credentials
                </span>
                <Chip
                  size="sm"
                  variant="flat"
                  color={settings.authTokenConfigured ? "success" : "default"}
                >
                  {settings.authTokenConfigured
                    ? "Configured"
                    : "Not configured"}
                </Chip>
              </CardHeader>
              <CardBody className="gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Account SID"
                    placeholder="AC…"
                    variant="bordered"
                    autoComplete="off"
                    value={draft.accountSid}
                    onValueChange={(v) => set({ accountSid: v })}
                  />
                  <Input
                    label="Auth Token"
                    type="password"
                    variant="bordered"
                    autoComplete="off"
                    placeholder={authPlaceholder}
                    description={
                      settings.authTokenConfigured
                        ? "A token is saved. Leave blank to keep it."
                        : "Secret — also used to validate webhook signatures."
                    }
                    value={draft.authToken}
                    onValueChange={(v) => set({ authToken: v })}
                  />
                  <Input
                    label="API Key SID"
                    placeholder="SK…"
                    variant="bordered"
                    autoComplete="off"
                    description="Used to mint short-lived browser voice tokens."
                    value={draft.apiKeySid}
                    onValueChange={(v) => set({ apiKeySid: v })}
                  />
                  <Input
                    label="API Key Secret"
                    type="password"
                    variant="bordered"
                    autoComplete="off"
                    placeholder={apiSecretPlaceholder}
                    description={
                      settings.apiKeySecretConfigured
                        ? "A secret is saved. Leave blank to keep it."
                        : "Secret — pairs with the API Key SID."
                    }
                    value={draft.apiKeySecret}
                    onValueChange={(v) => set({ apiKeySecret: v })}
                  />
                  <Input
                    label="TwiML App SID"
                    placeholder="AP…"
                    variant="bordered"
                    autoComplete="off"
                    description="Voice URL handles browser-originated calls."
                    value={draft.twimlAppSid}
                    onValueChange={(v) => set({ twimlAppSid: v })}
                  />
                  <Input
                    label="Phone Number"
                    placeholder="+15551234567"
                    variant="bordered"
                    autoComplete="off"
                    description="E.164 platform number for SMS & caller ID."
                    value={draft.phoneNumber}
                    onValueChange={(v) => set({ phoneNumber: v })}
                  />
                  <Input
                    label="Messaging Service SID (optional)"
                    placeholder="MG…"
                    variant="bordered"
                    autoComplete="off"
                    className="sm:col-span-2"
                    value={draft.messagingServiceSid}
                    onValueChange={(v) => set({ messagingServiceSid: v })}
                  />
                </div>
              </CardBody>
              <CardFooter className="justify-between">
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<PlugZap className="h-4 w-4" />}
                  isLoading={testing}
                  onPress={onTest}
                >
                  Test connection
                </Button>
                <Button
                  color="primary"
                  startContent={<Save className="h-4 w-4" />}
                  isLoading={saving}
                  isDisabled={!dirty}
                  onPress={onSave}
                >
                  Save changes
                </Button>
              </CardFooter>
            </Card>

            {/* Webhook URLs — register these in Twilio */}
            {settings?.webhooks && (
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col items-start gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Webhook className="h-4 w-4" /> Webhook URLs
                  </span>
                  <span className="text-xs text-default-500">
                    All Twilio webhooks use <span className="font-semibold text-foreground">HTTP POST</span>.
                    The phone-number webhooks (SMS &amp; Voice) can be set automatically below with
                    “Configurar webhooks”; the TwiML App Voice URL must be set by hand on your TwiML App.
                  </span>
                </CardHeader>
                <CardBody className="flex flex-col gap-2">
                  {[
                    { label: "SMS inbound", hint: "Phone number → Messaging → A message comes in", url: settings.webhooks.smsUrl },
                    { label: "SMS status", hint: "Status callback for outbound SMS", url: settings.webhooks.smsStatusUrl },
                    { label: "Voice inbound", hint: "Phone number → Voice → A call comes in", url: settings.webhooks.voiceUrl },
                    { label: "Voice status", hint: "Call status callback", url: settings.webhooks.voiceStatusUrl },
                    { label: "TwiML App Voice URL", hint: "Set manually on your TwiML App (browser-originated calls)", url: settings.webhooks.voiceOutboundUrl, highlight: true },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                        row.highlight ? "border-warning-200 bg-warning-50/40" : "border-default-200"
                      }`}
                    >
                      <Chip size="sm" variant="flat" color="success" className="shrink-0 font-semibold">POST</Chip>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{row.label}</span>
                          {row.highlight && (
                            <Chip size="sm" variant="flat" color="warning">manual</Chip>
                          )}
                        </div>
                        <code className="block truncate text-xs text-default-500">{row.url}</code>
                        <span className="text-[11px] text-default-400">{row.hint}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        isIconOnly
                        aria-label={`Copy ${row.label} URL`}
                        onPress={() => copyUrl(row.url)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            {/* Numbers */}
            <Card className="shadow-sm">
              <CardHeader className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    Phone numbers
                  </span>
                  <span className="text-xs text-default-500">
                    Point a number's SMS &amp; Voice webhooks at this platform.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<RefreshCw className="h-4 w-4" />}
                  isLoading={numbersLoading}
                  onPress={loadNumbers}
                >
                  Load numbers
                </Button>
              </CardHeader>
              <CardBody>
                {numbers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-default-400">
                    {numbersLoading
                      ? "Loading…"
                      : 'No numbers loaded. Click "Load numbers".'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                  <Table aria-label="Twilio incoming numbers" removeWrapper>
                    <TableHeader>
                      <TableColumn>NUMBER</TableColumn>
                      <TableColumn>NAME</TableColumn>
                      <TableColumn>CAPABILITIES</TableColumn>
                      <TableColumn>WEBHOOKS</TableColumn>
                      <TableColumn aria-label="Actions"> </TableColumn>
                    </TableHeader>
                    <TableBody>
                      {numbers.map((n) => {
                        const wired = !!(n.smsUrl || n.voiceUrl);
                        return (
                          <TableRow key={n.sid}>
                            <TableCell className="font-medium">
                              {n.phoneNumber}
                            </TableCell>
                            <TableCell className="text-default-500">
                              {n.friendlyName || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {n.capabilities?.voice && (
                                  <Chip size="sm" variant="flat">
                                    Voice
                                  </Chip>
                                )}
                                {n.capabilities?.sms && (
                                  <Chip size="sm" variant="flat">
                                    SMS
                                  </Chip>
                                )}
                                {n.capabilities?.mms && (
                                  <Chip size="sm" variant="flat">
                                    MMS
                                  </Chip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={wired ? "success" : "default"}
                              >
                                {wired ? "Configured" : "Not set"}
                              </Chip>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="flat"
                                color="primary"
                                startContent={<Webhook className="h-4 w-4" />}
                                isLoading={configuringSid === n.sid}
                                onPress={() => onConfigure(n)}
                              >
                                Configurar webhooks
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
