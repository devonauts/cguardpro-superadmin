import { get, post, put } from "@/lib/api";
import type { StripeSettings } from "@/types";

/** Body for PUT /settings/stripe — all fields optional; only sent fields are
 *  updated. Empty/omitted secret leaves the stored value unchanged. */
export interface StripeModeUpdate {
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  priceGrowth?: string;
  priceEnterprise?: string;
}

export interface StripeSettingsUpdate {
  mode?: "test" | "live";
  test?: StripeModeUpdate;
  live?: StripeModeUpdate;
}

export interface StripeTestResult {
  ok: boolean;
  accountId?: string;
  livemode?: boolean;
  error?: string;
}

export interface WebhookRegisterResult {
  ok: boolean;
  endpointId?: string;
  error?: string;
}

export const settingsService = {
  stripe: {
    get: () => get<StripeSettings>("/superadmin/settings/stripe"),
    save: (body: StripeSettingsUpdate) =>
      put<StripeSettings>("/superadmin/settings/stripe", body),
    test: (mode: "test" | "live") =>
      post<StripeTestResult>("/superadmin/settings/stripe/test", { mode }),
    /** Creates the webhook endpoint in Stripe and stores its signing secret. */
    registerWebhook: (mode: "test" | "live") =>
      post<WebhookRegisterResult>("/superadmin/settings/stripe/webhook", { mode }),
  },
};
