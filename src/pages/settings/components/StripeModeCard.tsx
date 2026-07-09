import { Card, CardHeader, CardBody, CardFooter, Input, Button, Chip } from "@heroui/react";
import { PlugZap, Webhook } from "lucide-react";
import type { StripeModeConfig } from "@/types";

/** Editable draft for one Stripe mode. Secret fields hold ONLY what the user
 *  typed this session; an empty string means "leave the saved value alone". */
export interface ModeDraft {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  priceGrowth: string;
  priceEnterprise: string;
}

export function StripeModeCard({
  mode,
  title,
  active,
  config,
  draft,
  onChange,
  onTest,
  testing,
  onRegisterWebhook,
  registering,
}: {
  mode: "test" | "live";
  title: string;
  active: boolean;
  config: StripeModeConfig;
  draft: ModeDraft;
  onChange: (patch: Partial<ModeDraft>) => void;
  onTest: () => void;
  testing: boolean;
  onRegisterWebhook?: () => void;
  registering?: boolean;
}) {
  const secretPlaceholder = config.secretKeyConfigured
    ? `•••• ${config.secretKeyLast4 ?? "????"} (saved — leave blank to keep)`
    : "sk_…";
  const webhookPlaceholder = config.webhookSecretConfigured
    ? "•••• (saved — leave blank to keep)"
    : "whsec_…";

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {active && (
            <Chip size="sm" variant="flat" color="primary">
              Active
            </Chip>
          )}
        </div>
        <Chip
          size="sm"
          variant="flat"
          color={config.secretKeyConfigured ? "success" : "default"}
        >
          {config.secretKeyConfigured ? "Configured" : "Not configured"}
        </Chip>
      </CardHeader>

      <CardBody className="gap-4">
        <Input
          label="Publishable key"
          placeholder="pk_…"
          variant="bordered"
          autoComplete="off"
          value={draft.publishableKey}
          onValueChange={(v) => onChange({ publishableKey: v })}
        />
        <Input
          label="Secret key"
          type="password"
          variant="bordered"
          autoComplete="off"
          placeholder={secretPlaceholder}
          description={
            config.secretKeyConfigured
              ? "A secret is saved. Leave blank to keep it."
              : "Starts with sk_"
          }
          value={draft.secretKey}
          onValueChange={(v) => onChange({ secretKey: v })}
        />
        <Input
          label="Webhook signing secret"
          type="password"
          variant="bordered"
          autoComplete="off"
          placeholder={webhookPlaceholder}
          description={
            config.webhookSecretConfigured
              ? "A webhook secret is saved. Leave blank to keep it."
              : "Starts with whsec_"
          }
          value={draft.webhookSecret}
          onValueChange={(v) => onChange({ webhookSecret: v })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Price ID — Growth"
            placeholder="price_… (optional)"
            variant="bordered"
            autoComplete="off"
            value={draft.priceGrowth}
            onValueChange={(v) => onChange({ priceGrowth: v })}
          />
          <Input
            label="Price ID — Enterprise"
            placeholder="price_… (optional)"
            variant="bordered"
            autoComplete="off"
            value={draft.priceEnterprise}
            onValueChange={(v) => onChange({ priceEnterprise: v })}
          />
        </div>
      </CardBody>

      <CardFooter className="justify-between gap-2">
        {onRegisterWebhook ? (
          <Button
            size="sm"
            variant="flat"
            color={config.webhookSecretConfigured ? "default" : "warning"}
            startContent={<Webhook className="h-4 w-4" />}
            isLoading={registering}
            isDisabled={!config.secretKeyConfigured}
            onPress={onRegisterWebhook}
            title="Creates the webhook endpoint in Stripe and saves its signing secret. Without it, payments don't update tenant status."
          >
            {config.webhookSecretConfigured ? "Re-register webhook" : "Register webhook"}
          </Button>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          variant="flat"
          startContent={<PlugZap className="h-4 w-4" />}
          isLoading={testing}
          onPress={onTest}
        >
          Test connection
        </Button>
      </CardFooter>
    </Card>
  );
}

export default StripeModeCard;
