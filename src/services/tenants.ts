import { get, post, put, del } from "@/lib/api";
import type { Paginated, TenantRow, TenantDetail } from "@/types";

export interface TenantListParams {
  search?: string;
  plan?: string;
  billingStatus?: string;
  page?: number;
  limit?: number;
}

export const tenantsService = {
  list: (params: TenantListParams = {}) =>
    get<Paginated<TenantRow>>("/superadmin/tenants", params),
  detail: (id: string) => get<TenantDetail>(`/superadmin/tenants/${id}`),
  create: (body: Record<string, any>) => post<TenantDetail>("/superadmin/tenants", body),
  update: (id: string, body: Record<string, any>) =>
    put<TenantDetail>(`/superadmin/tenants/${id}`, body),
  suspend: (id: string, reason: string) =>
    post<{ success: boolean }>(`/superadmin/tenants/${id}/suspend`, { reason }),
  reactivate: (id: string) =>
    post<{ success: boolean }>(`/superadmin/tenants/${id}/reactivate`),
  extendTrial: (id: string, body: { days?: number; until?: string }) =>
    post<TenantDetail>(`/superadmin/tenants/${id}/extend-trial`, body),
  remove: (id: string) =>
    del<{ success: boolean; recordsDeleted: number; tables: string[] }>(
      `/superadmin/tenants/${id}`,
      { confirm: "true" },
    ),
  exportUrl: (id: string) => `/superadmin/tenants/${id}/export`,
  export: (id: string) =>
    get<{ tenant: any; tables: Record<string, any[]>; exportedAt: string }>(
      `/superadmin/tenants/${id}/export`,
    ),
};
