import { get, post } from "@/lib/api";
import type { Paginated, UserRow, GuardRow, PlatformUserRow } from "@/types";

export const usersService = {
  list: (params: { search?: string; tenantId?: string; role?: string; status?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<UserRow>>("/superadmin/users", params),
  platformUsers: (
    params: {
      search?: string;
      page?: number;
      limit?: number;
      hasCompany?: "yes" | "no" | "";
      billing?: string;
    } = {},
  ) => get<Paginated<PlatformUserRow>>("/superadmin/platform-users", params),
  detail: (tenantUserId: string) => get<UserRow & { assignments?: any }>(`/superadmin/users/${tenantUserId}`),
  setStatus: (tenantUserId: string, status: string) =>
    post<{ success: boolean }>(`/superadmin/users/${tenantUserId}/status`, { status }),
  guards: (params: { search?: string; tenantId?: string; page?: number; limit?: number } = {}) =>
    get<Paginated<GuardRow>>("/superadmin/guards", params),
};
