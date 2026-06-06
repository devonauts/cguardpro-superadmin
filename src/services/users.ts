import { get, post } from "@/lib/api";
import type { Paginated, UserRow, GuardRow } from "@/types";

export const usersService = {
  list: (params: { search?: string; tenantId?: string; role?: string; status?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<UserRow>>("/superadmin/users", params),
  detail: (tenantUserId: string) => get<UserRow & { assignments?: any }>(`/superadmin/users/${tenantUserId}`),
  setStatus: (tenantUserId: string, status: string) =>
    post<{ success: boolean }>(`/superadmin/users/${tenantUserId}/status`, { status }),
  guards: (params: { search?: string; tenantId?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<GuardRow>>("/superadmin/guards", params),
};
