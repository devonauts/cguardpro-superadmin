import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from "date-fns";

/** Parse an ISO string (or Date) defensively. */
function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  try {
    return parseISO(value);
  } catch {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
}

/**
 * Pretty-print an E.164-ish phone number for display.
 *  +14155552671 → +1 (415) 555-2671
 * Falls back to the raw string for anything that doesn't match NANP.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  // US/Canada (NANP): 11 digits starting with 1, or 10 digits.
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return trimmed;
}

/** Compact timestamp for a conversation row: "14:32", "Yesterday", "Mar 4". */
export function formatConversationTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

/** Bubble timestamp: "14:32". */
export function formatBubbleTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "HH:mm") : "";
}

/** Full relative time for tooltips: "3 minutes ago". */
export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : "";
}

/** Day separator label for the thread: "Today", "Yesterday", "March 4, 2026". */
export function formatDaySeparator(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

/** YYYY-MM-DD key used to group messages into day buckets. */
export function dayKey(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "yyyy-MM-dd") : "";
}

/**
 * Map a Twilio outbound message status to a HeroUI color + short glyph/label.
 * Inbound messages don't carry a meaningful delivery status.
 *   queued/accepted/sending → sending
 *   sent                    → sent
 *   delivered/read          → delivered
 *   undelivered/failed      → failed
 */
export type MsgStatusKind = "sending" | "sent" | "delivered" | "failed" | "none";

export function statusKind(status: string | null | undefined): MsgStatusKind {
  switch ((status || "").toLowerCase()) {
    case "queued":
    case "accepted":
    case "scheduled":
    case "sending":
      return "sending";
    case "sent":
      return "sent";
    case "delivered":
    case "read":
    case "received":
      return "delivered";
    case "undelivered":
    case "failed":
      return "failed";
    default:
      return "none";
  }
}

/** Basic E.164 validation for the composer "to" field. */
export function isLikelyPhone(raw: string): boolean {
  const digits = raw.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Normalize a user-typed number toward E.164 (default +1 for 10-digit NANP). */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/[^\d]/g, "");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}
