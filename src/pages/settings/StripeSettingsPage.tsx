import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Tabs,
  Tab,
  Chip,
  Button,
} from "@heroui/react";
import { Save, Database, Server, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataState } from "@/components/ui/DataState";
import { fmtDateTime } from "@/lib/format";
import { settingsService } from "@/services/settings";
import type {
  StripeModeUpdate,
  StripeSettingsUpdate,
} from "@/services/settings";
import type { StripeSettings } from "@/types";
import { StripeModeCard, type ModeDraft } from "./components/StripeModeCard";

const EMPTY_DRAFT: ModeDraft = {
  publishableKey: "",
  secretKey: "",
  webhookSecret: "",
  priceGrowth: "",
  priceEnterprise: "",
};

/** A draft for a mode, seeded from the saved config. Publishable key and price
 *  IDs are not secret, so we prefill them; secrets stay blank by design. */
function draftFrom(c: StripeSettings["test"]): ModeDraft {
  return {
    publishableKey: c.publishableKey || "",
    secretKey: "",
    webhookSecret: "",
    priceGrowth: c.priceGrowth || "",
    priceEnterprise: c.priceEnterprise || "",
  };
}

/** Build the PUT body for one mode: only changed/non-secret fields, and secret
 *  fields ONLY when the user actually typed something. Returns undefined if the
 *  mode has no changes. */
function diffMode(
  saved: StripeSettings["test"],
  draft: ModeDraft,
): StripeModeUpdate | undefined {
  const patch: StripeModeUpdate = {};

  if (draft.publishableKey !== (saved.publishableKey || ""))
    patch.publishableKey = draft.publishableKey;
  if (draft.priceGrowth !== (saved.priceGrowth || ""))
    patch.priceGrowth = draft.priceGrowth;
  if (draft.priceEnterprise !== (saved.priceEnterprise || ""))
    patch.priceEnterprise = draft.priceEnterprise;

  // Secrets: send only if the user typed a value this session.
  if (draft.secretKey.trim()) patch.secretKey = draft.secretKey.trim();
  if (draft.webhookSecret.trim())
    patch.webhookSecret = draft.webhookSecret.trim();

  return Object.keys(patch).length ? patch : undefined;
}

export default function StripeSettingsPage() {
  const [settings, setSettings] = useState<StripeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"test" | "live">("test");
  const [testDraft, setTestDraft] = useState<ModeDraft>(EMPTY_DRAFT);
  const [liveDraft, setLiveDraft] = useState<ModeDraft>(EMPTY_DRAFT);

  const [saving, setSaving] = useState(false);
  const [testingMode, setTestingMode] = useState<"test" | "live" | null>(null);
  const [registeringMode, setRegisteringMode] = useState<"test" | "live" | null>(null);

  const hydrate = useCallback((s: StripeSettings) => {
    setSettings(s);
    setMode(s.mode);
    setTestDraft(draftFrom(s.test));
    setLiveDraft(draftFrom(s.live));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      hydrate(await settingsService.stripe.get());
    } catch (e: any) {
      setError(e?.message || "Failed to load Stripe settings");
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!settings) return false;
    if (mode !== settings.mode) return true;
    return (
      !!diffMode(settings.test, testDraft) ||
      !!diffMode(settings.live, liveDraft)
    );
  }, [settings, mode, testDraft, liveDraft]);

  const onSave = async () => {
    if (!settings) return;
    const body: StripeSettingsUpdate = {};
    if (mode !== settings.mode) body.mode = mode;
    const t = diffMode(settings.test, testDraft);
    const l = diffMode(settings.live, liveDraft);
    if (t) body.test = t;
    if (l) body.live = l;

    if (!Object.keys(body).length) {
      toast.info("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const updated = await settingsService.stripe.save(body);
      hydrate(updated);
      toast.success("Stripe settings saved");
    } catch {
      /* toast via interceptor */
    } finally {
      setSaving(false);
    }
  };

  const onTest = async (m: "test" | "live") => {
    setTestingMode(m);
    try {
      const res = await settingsService.stripe.test(m);
      if (res.ok) {
        toast.success(
          `Connected: ${res.accountId ?? "account"} (livemode: ${
            res.livemode ? "yes" : "no"
          })`,
        );
      } else {
        toast.error(res.error || "Connection failed");
      }
    } catch {
      /* toast via interceptor */
    } finally {
      setTestingMode(null);
    }
  };

  // Creates the webhook endpoint in Stripe and stores its signing secret —
  // without this, payments succeed but tenant statuses never update.
  const onRegisterWebhook = async (m: "test" | "live") => {
    setRegisteringMode(m);
    try {
      const res = await settingsService.stripe.registerWebhook(m);
      if (res.ok) {
        toast.success(`Webhook registered in Stripe (${res.endpointId}) and signing secret saved`);
        load();
      } else {
        toast.error(res.error || "Webhook registration failed");
      }
    } catch {
      /* toast via interceptor */
    } finally {
      setRegisteringMode(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Stripe"
        subtitle="Connect your Stripe account to take payments"
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
            {/* Active mode + source */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-col items-start gap-1">
                <span className="text-sm font-semibold text-foreground">
                  Active mode
                </span>
                <span className="text-xs text-default-500">
                  Choose which set of keys the platform uses to process payments.
                </span>
              </CardHeader>
              <CardBody className="gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Tabs
                    aria-label="Active Stripe mode"
                    selectedKey={mode}
                    onSelectionChange={(k) => setMode(k as "test" | "live")}
                    color="primary"
                  >
                    <Tab key="test" title="Test" />
                    <Tab key="live" title="Live (production)" />
                  </Tabs>

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
                      ? "Using saved keys"
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
                    The platform charges <span className="font-medium">$5 per user</span>{" "}
                    per month plus Stripe processing fees, billed to each tenant
                    through the connected account.
                  </span>
                </div>
              </CardBody>
            </Card>

            {/* Mode cards */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <StripeModeCard
                mode="test"
                title="Test mode"
                active={mode === "test"}
                config={settings.test}
                draft={testDraft}
                onChange={(patch) =>
                  setTestDraft((d) => ({ ...d, ...patch }))
                }
                onTest={() => onTest("test")}
                testing={testingMode === "test"}
                onRegisterWebhook={() => onRegisterWebhook("test")}
                registering={registeringMode === "test"}
              />
              <StripeModeCard
                mode="live"
                title="Live (production) mode"
                active={mode === "live"}
                config={settings.live}
                draft={liveDraft}
                onChange={(patch) =>
                  setLiveDraft((d) => ({ ...d, ...patch }))
                }
                onTest={() => onTest("live")}
                testing={testingMode === "live"}
                onRegisterWebhook={() => onRegisterWebhook("live")}
                registering={registeringMode === "live"}
              />
            </div>

            <div className="flex justify-end">
              <Button
                color="primary"
                startContent={<Save className="h-4 w-4" />}
                isLoading={saving}
                isDisabled={!dirty}
                onPress={onSave}
              >
                Save changes
              </Button>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
