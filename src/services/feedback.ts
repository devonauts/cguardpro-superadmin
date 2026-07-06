import { get } from "@/lib/api";

export interface FeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  source: string;
  createdAt: string;
  tenant: { id: string; name: string } | null;
  user: { id: string; name: string; email: string } | null;
}

export interface FeedbackList {
  rows: FeedbackRow[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { total: number; avg: number; distribution: Record<string, number> };
}

export interface FeedbackListParams {
  search?: string;
  rating?: number;
  source?: string;
  page?: number;
  limit?: number;
}

export const feedbackService = {
  list: (params: FeedbackListParams = {}) =>
    get<FeedbackList>("/superadmin/feedback", params),
};
