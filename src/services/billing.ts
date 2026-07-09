import { get, post } from "@/lib/api";
import type {
  Paginated,
  BillingOverview,
  TenantBillingRow,
  InvoiceRow,
  BillingSummary,
} from "@/types";

/** A Stripe invoice we charged a tenant (platform payment record). */
export interface PlatformInvoice {
  id: string;
  stripeInvoiceId: string;
  number: string | null;
  status: string; // draft | open | paid | void | uncollectible
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  linesSummary: string | null;
  paidAt: string | null;
  issuedAt: string | null;
}

export interface PlatformPaymentRow extends PlatformInvoice {
  tenantId: string;
  tenantName: string | null;
}

export const billingService = {
  overview: () => get<BillingOverview>("/superadmin/billing/overview"),
  tenants: (params: { search?: string; billingStatus?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<TenantBillingRow>>("/superadmin/billing/tenants", params),
  tenantDetail: (id: string) =>
    get<{ tenant: { id: string; name: string; email: string | null }; summary: BillingSummary; invoices: InvoiceRow[] }>(
      `/superadmin/billing/tenants/${id}`,
    ),
  invoices: (params: { search?: string; status?: string; tenantId?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<InvoiceRow>>("/superadmin/billing/invoices", params),

  // ── Stripe subscription payments (platform charges to tenants) ──────────
  /** Per-tenant Stripe invoice history; the backend refreshes from Stripe first. */
  subscriptionInvoices: (id: string) =>
    get<{ invoices: PlatformInvoice[]; synced: number; syncError: string | null }>(
      `/superadmin/billing/tenants/${id}/subscription-invoices`,
    ),
  /** Cross-tenant recent Stripe payments feed. */
  payments: (params: { page?: number; limit?: number; status?: string } = {}) =>
    get<{ rows: PlatformPaymentRow[]; count: number }>("/superadmin/billing/payments", params),
  /** Full refund of a paid subscription invoice. */
  refundInvoice: (tenantId: string, invoiceId: string) =>
    post<{ ok: boolean; refundId: string; amountCents: number; status: string }>(
      `/superadmin/billing/tenants/${tenantId}/subscription-invoices/${invoiceId}/refund`,
    ),
  /** Cancel the tenant's REAL Stripe subscription. */
  cancelSubscription: (tenantId: string, immediately: boolean) =>
    post<{ ok: boolean; immediately: boolean; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null }>(
      `/superadmin/billing/tenants/${tenantId}/subscription/cancel`,
      { immediately },
    ),
};
