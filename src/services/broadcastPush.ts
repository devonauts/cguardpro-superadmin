import { get, post } from "@/lib/api";

/** Blast radius of a platform-wide push (all tenants, all devices). */
export interface BroadcastAudience {
  devices: number;
  uniqueTokens: number;
  /** False when FCM creds aren't set on the backend — sends will no-op. */
  configured: boolean;
}

export interface BroadcastResult {
  sent: number;
  failed?: number;
  skipped?: boolean;
  error?: boolean;
  devices?: number;
}

export interface BroadcastPushBody {
  title: string;
  body: string;
  link?: string;
  timeSensitive?: boolean;
}

export const broadcastPushService = {
  audience: () => get<BroadcastAudience>("/superadmin/broadcast-push/audience"),
  send: (body: BroadcastPushBody) =>
    post<BroadcastResult>("/superadmin/broadcast-push", body),
};

export default broadcastPushService;
