import { get, post, put } from "@/lib/api";

/**
 * Typed API wrappers for the platform Twilio phone center.
 * Backend routes live under /api/superadmin (settings) and /api/superadmin/twilio.
 * Secrets are write-only: the masked GET returns only *Configured flags + last4.
 */

// ── Settings ────────────────────────────────────────────────────────────────

/** Masked view of the saved Twilio config. Never includes raw secrets. */
export interface TwilioSettingsMasked {
  accountSid: string | null;
  apiKeySid: string | null;
  twimlAppSid: string | null;
  phoneNumber: string | null;
  messagingServiceSid: string | null;
  authTokenConfigured: boolean;
  authTokenLast4: string | null;
  apiKeySecretConfigured: boolean;
  apiKeySecretLast4: string | null;
  /** 'db' = using saved keys, 'env' = falling back to env vars. */
  source: "db" | "env";
  updatedAt: string | null;
}

/** PUT body — only sent fields are updated; blank secret leaves it unchanged. */
export interface TwilioSettingsUpdate {
  accountSid?: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  twimlAppSid?: string;
  phoneNumber?: string;
  messagingServiceSid?: string;
}

export interface TwilioTestResult {
  ok: boolean;
  accountSid?: string;
  friendlyName?: string;
  status?: string;
  error?: string;
}

// ── Numbers ───────────────────────────────────────────────────────────────

export interface TwilioIncomingNumber {
  sid: string;
  phoneNumber: string;
  friendlyName?: string | null;
  smsUrl?: string | null;
  voiceUrl?: string | null;
  capabilities?: { voice?: boolean; sms?: boolean; mms?: boolean } | null;
}

export interface ConfigureWebhooksResult {
  ok: boolean;
  sid?: string;
  smsUrl?: string;
  voiceUrl?: string;
  error?: string;
}

// ── Voice ─────────────────────────────────────────────────────────────────

export interface VoiceToken {
  token: string;
  identity: string;
}

// ── Messaging ───────────────────────────────────────────────────────────────

export interface TwilioConversation {
  id: string;
  peerNumber: string;
  ourNumber: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TwilioMessage {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  fromNumber: string;
  toNumber: string;
  body: string;
  twilioSid: string | null;
  status: string;
  mediaUrls: string[] | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Calls ─────────────────────────────────────────────────────────────────

export interface TwilioCall {
  id: string;
  callSid: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  status: string | null;
  durationSec: number | null;
  startedAt: string | null;
  endedAt: string | null;
  recordingUrl: string | null;
  createdAt: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

export const twilioService = {
  settings: {
    get: () => get<TwilioSettingsMasked>("/superadmin/settings/twilio"),
    save: (body: TwilioSettingsUpdate) =>
      put<TwilioSettingsMasked>("/superadmin/settings/twilio", body),
    test: () => post<TwilioTestResult>("/superadmin/settings/twilio/test"),
  },

  numbers: {
    list: () =>
      get<{ numbers: TwilioIncomingNumber[] }>("/superadmin/twilio/numbers"),
    configure: (body: { phoneSid?: string; phoneNumber?: string }) =>
      post<ConfigureWebhooksResult>(
        "/superadmin/twilio/numbers/configure",
        body,
      ),
  },

  voiceToken: () => get<VoiceToken>("/superadmin/twilio/voice-token"),

  conversations: {
    list: (params?: { page?: number; limit?: number }) =>
      get<Paged<TwilioConversation>>(
        "/superadmin/twilio/conversations",
        params,
      ),
    messages: (id: string, params?: { page?: number }) =>
      get<Paged<TwilioMessage>>(
        `/superadmin/twilio/conversations/${id}/messages`,
        params,
      ),
    markRead: (id: string) =>
      post<{ ok: boolean }>(`/superadmin/twilio/conversations/${id}/read`),
  },

  sendMessage: (body: { to: string; body: string }) =>
    post<{ conversationId: string; message: TwilioMessage }>(
      "/superadmin/twilio/messages",
      body,
    ),

  calls: {
    list: (params?: { page?: number }) =>
      get<Paged<TwilioCall>>("/superadmin/twilio/calls", params),
    create: (body: { to: string }) =>
      post<{ call: TwilioCall }>("/superadmin/twilio/calls", body),
  },
};

export default twilioService;
