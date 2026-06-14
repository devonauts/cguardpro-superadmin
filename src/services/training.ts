import { get, post } from "@/lib/api";
import type { AddonCourse, AddonCourseGrant } from "@/types";

/**
 * SuperAdmin · Training (platform addon courses + grants).
 *
 * Backend endpoints (mounted under /api/superadmin, behind requireSuperadmin):
 *   POST /superadmin/training/addon-courses   → create platform addon course
 *   GET  /superadmin/training/addon-courses   → { rows, count } catalog
 *   POST /superadmin/training/grants          → grant/sell addon to a tenant
 *   GET  /superadmin/training/grants          → { rows, count } grants
 *
 * These list endpoints return only { rows, count } (no page/limit/totalPages),
 * so the pages compute pagination locally.
 */

export interface AddonCourseInput {
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  category?: string | null;
  level?: string | null;
  pointsValue?: number;
  passingScore?: number;
  addonPrice?: number | null;
  certificateTemplate?: string | null;
  published?: boolean;
}

export interface GrantInput {
  addonCourseId: string;
  tenantId: string;
  expiresAt?: string | null;
  seatCount?: number | null;
  pricePaid?: number | null;
}

export interface AddonCourseListParams {
  page?: number;
  limit?: number;
}

export interface GrantListParams {
  tenantId?: string;
  page?: number;
  limit?: number;
}

export interface ListResult<T> {
  rows: T[];
  count: number;
}

export const trainingService = {
  listCourses: (params: AddonCourseListParams = {}) =>
    get<ListResult<AddonCourse>>("/superadmin/training/addon-courses", params),
  createCourse: (body: AddonCourseInput) =>
    post<AddonCourse>("/superadmin/training/addon-courses", { data: body }),
  listGrants: (params: GrantListParams = {}) =>
    get<ListResult<AddonCourseGrant>>("/superadmin/training/grants", params),
  createGrant: (body: GrantInput) =>
    post<AddonCourseGrant>("/superadmin/training/grants", { data: body }),
};
