/**
 * Shared types for the SuperAdmin panel. These mirror the JSON payloads
 * returned by the backend `/api/superadmin/*` endpoints (see CONTRACT.md).
 * Endpoints return their payload DIRECTLY (no { success, data } wrapper),
 * matching the rest of the cguard backend.
 */

// ── Auth ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  isSuperadmin?: boolean;
  roles?: string[];
}
export interface SignInResponse {
  token: string;
  user: AuthUser;
}

// ── Common ────────────────────────────────────────────────────────────────────
export interface Paginated<T> {
  rows: T[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "trial_expired"
  | "canceled";

export interface TrialInfo {
  endsAt: string | null;
  daysLeft: number;
  active: boolean;
  expired: boolean;
}

export interface BillingQuote {
  seats: number;
  perUserCents: number;
  platformFeeCents: number;
  monthlyCents: number;
  implementationCents: number;
  firstChargeCents: number;
  currency: string;
  netMonthlyCents: number;
}

export interface BillingSummary {
  status: BillingStatus | string;
  trial: TrialInfo;
  seats: number;
  implementationPaid: boolean;
  hasSubscription: boolean;
  quote: BillingQuote;
  trialDays: number;
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardData {
  tenants: {
    total: number;
    active: number;
    trialing: number;
    pastDue: number;
    suspended: number;
    canceled: number;
    newThisMonth: number;
  };
  users: { total: number; guards: number; staff: number };
  billing: {
    mrrCents: number;
    arrCents: number;
    netMrrCents: number;
    payingTenants: number;
    trialingTenants: number;
    activeSeats: number;
  };
  recentTenants: TenantRow[];
  recentAudit: AuditEntry[];
}

// ── Tenants ──────────────────────────────────────────────────────────────────
export interface TenantRow {
  id: string;
  name: string;
  url: string | null;
  email: string | null;
  plan: string | null;
  planStatus: string | null;
  billingStatus: BillingStatus | string;
  suspendedAt: string | null;
  seats: number;
  mrrCents: number;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface TenantDetail extends TenantRow {
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  taxNumber?: string | null;
  businessTitle?: string | null;
  website?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  implementationPaidAt?: string | null;
  suspensionReason?: string | null;
  counts: Record<string, number>;
  billing: BillingSummary;
}

// ── Billing ──────────────────────────────────────────────────────────────────
export interface BillingOverview {
  mrrCents: number;
  arrCents: number;
  netMrrCents: number;
  payingTenants: number;
  trialingTenants: number;
  pastDueTenants: number;
  activeSeats: number;
  avgSeatsPerPayingTenant: number;
  perUserCents: number;
  platformFeeCents: number;
  byStatus: Record<string, number>;
  mrrByPlan: { plan: string; mrrCents: number; tenants: number }[];
}

export interface TenantBillingRow {
  id: string;
  name: string;
  billingStatus: BillingStatus | string;
  seats: number;
  monthlyCents: number;
  netMonthlyCents: number;
  hasSubscription: boolean;
  implementationPaid: boolean;
  trial: TrialInfo;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface InvoiceRow {
  id: string;
  tenantId: string;
  tenantName: string;
  invoiceNumber: string;
  status: string;
  date: string | null;
  dueDate: string | null;
  subtotal: number | null;
  total: number | null;
  clientName: string | null;
}

// ── Users ────────────────────────────────────────────────────────────────────
export interface UserRow {
  id: string; // tenantUser id
  userId: string;
  fullName: string;
  email: string;
  tenantId: string;
  tenantName: string;
  roles: string[];
  status: string;
  createdAt: string;
}

export interface CompanyMembership {
  tenantId: string;
  tenantName: string;
  roles: string[];
  status: string;
  billingStatus: string;
  billPaid: boolean;
  suspended: boolean;
}

export interface PlatformUserRow {
  id: string;
  email: string;
  fullName: string;
  isSuperadmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  companies: CompanyMembership[];
  companyCount: number;
  primaryCompany: string | null;
  billingStatus: string | null;
  billPaid: boolean | null; // true=a company is paid(active), false=has company but none paid, null=no company
}

export interface GuardRow {
  id: string;
  fullName: string;
  governmentId: string | null;
  tenantId: string;
  tenantName: string;
  guardType: string | null;
  isOnDuty: boolean;
  createdAt: string;
}

// ── Observability ────────────────────────────────────────────────────────────
export interface HealthReport {
  status: "ok" | "degraded" | "down" | string;
  database: { connected: boolean; dialect: string | null; latencyMs: number | null };
  uptimeSeconds: number;
  memory: { rss: number; heapUsed: number; heapTotal: number };
  nodeVersion: string;
  timestamp: string;
}

export interface TableStat {
  name: string;
  count: number;
}

export interface AuditEntry {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  tenantId: string | null;
  method: string | null;
  path: string | null;
  ip: string | null;
  statusCode: number | null;
  details: any;
  createdAt: string;
}

// ── Settings · Stripe ────────────────────────────────────────────────────────
/** Per-mode (test/live) Stripe config as returned by the API. Secrets are
 *  write-only: only configured flags + the secret-key last4 are exposed. */
export interface StripeModeConfig {
  publishableKey: string;
  secretKeyConfigured: boolean;
  secretKeyLast4: string | null;
  webhookSecretConfigured: boolean;
  priceGrowth: string | null;
  priceEnterprise: string | null;
}

export interface StripeSettings {
  mode: "test" | "live";
  /** Where the ACTIVE config currently resolves from. */
  source: "db" | "env";
  updatedAt: string | null;
  test: StripeModeConfig;
  live: StripeModeConfig;
}
