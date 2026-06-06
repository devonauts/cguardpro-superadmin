import { format, formatDistanceToNow, parseISO } from "date-fns";

/** USD cents → "$1,234.56". */
export function usd(cents: number | null | undefined): string {
  const n = (cents || 0) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Plain number → "$1,234.56" (already in dollars). */
export function usdFromDollars(dollars: number | null | undefined): string {
  return (Number(dollars) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function compactNumber(n: number | null | undefined): string {
  return (n || 0).toLocaleString("en-US");
}

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

export function fmtDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "MMM d, yyyy") : "—";
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "MMM d, yyyy HH:mm") : "—";
}

export function fmtRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "—";
}

export function fmtBytes(bytes: number | null | undefined): string {
  const b = bytes || 0;
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

export function fmtUptime(seconds: number | null | undefined): string {
  let s = Math.floor(seconds || 0);
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.length ? parts.join(" ") : "<1m";
}

/** Map a billing/lifecycle status to a HeroUI color name. */
export function statusColor(
  status: string | null | undefined,
): "success" | "warning" | "danger" | "default" | "primary" | "secondary" {
  switch ((status || "").toLowerCase()) {
    case "active":
    case "ok":
    case "paid":
    case "pagado":
      return "success";
    case "trialing":
    case "pending":
    case "pendiente":
      return "primary";
    case "past_due":
    case "degraded":
    case "en mora":
      return "warning";
    case "trial_expired":
    case "canceled":
    case "suspended":
    case "down":
    case "rechazado":
      return "danger";
    default:
      return "default";
  }
}

/** Human label for billing statuses. */
export function billingStatusLabel(status: string | null | undefined): string {
  switch ((status || "").toLowerCase()) {
    case "trialing":
      return "Trial";
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "trial_expired":
      return "Trial expired";
    case "canceled":
      return "Canceled";
    default:
      return status || "—";
  }
}
