import { get } from "@/lib/api";
import type { DashboardData } from "@/types";

export const dashboardService = {
  load: () => get<DashboardData>("/superadmin/dashboard"),
};
