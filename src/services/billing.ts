import { get } from "@/lib/api";
import type {
  Paginated,
  BillingOverview,
  TenantBillingRow,
  InvoiceRow,
  BillingSummary,
} from "@/types";

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
};
