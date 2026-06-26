import { get, post } from "@/lib/api";

/** Which app(s) a broadcast targets. Omit `app` (undefined) to hit both. */
export type BroadcastApp = "worker" | "client";

/** Blast radius of a platform-wide push (all tenants), broken down by app + transport. */
export interface BroadcastAudience {
  total: number;
  worker: number; // C-Guard Pro devices (FCM)
  client: number; // Mi Seguridad devices (APNs / FCM)
  apns: number; // devices delivered via direct APNs
  fcm: number; // devices delivered via FCM
  /** False when FCM creds aren't set on the backend. */
  fcmConfigured: boolean;
  /** False when the APNs .p8 isn't on the backend. */
  apnsConfigured: boolean;
}

export interface BroadcastResult {
  sent: number;
  devices?: number;
  fcm?: { sent?: number; failed?: number; skipped?: boolean };
  apns?: { sent?: number; failed?: number; skipped?: boolean };
  skipped?: boolean;
  error?: boolean;
}

export interface BroadcastPushBody {
  title: string;
  body: string;
  link?: string;
  timeSensitive?: boolean;
  /** 'worker' | 'client' | omit for both apps. */
  app?: BroadcastApp;
}

export const broadcastPushService = {
  audience: () => get<BroadcastAudience>("/superadmin/broadcast-push/audience"),
  send: (body: BroadcastPushBody) =>
    post<BroadcastResult>("/superadmin/broadcast-push", body),
};

export default broadcastPushService;
