import { get, post, put, del } from "@/lib/api";
import type { PlanCatalogResponse, PlanCatalog } from "@/types";

export const plansService = {
  list: () => get<PlanCatalogResponse>("/superadmin/plans"),
  create: (body: Partial<PlanCatalog>) =>
    post<PlanCatalog>("/superadmin/plans", body),
  update: (id: string, body: Partial<PlanCatalog>) =>
    put<PlanCatalog>(`/superadmin/plans/${id}`, body),
  remove: (id: string) =>
    del<{ success: boolean }>(`/superadmin/plans/${id}`),
};
