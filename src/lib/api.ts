import axios, { AxiosError, AxiosInstance } from "axios";
import { toast } from "sonner";

/**
 * Axios client for the SuperAdmin panel.
 *
 * Base URL: VITE_API_URL if set, else "/api" (served same-origin and proxied
 * by nginx / the vite dev server to the backend). The superadmin JWT — issued
 * by the normal /api/auth/sign-in flow for users with isSuperadmin — is stored
 * in localStorage and attached as a Bearer token.
 */
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || "/api";
const TOKEN_KEY = "cguard_sa_token";

let _token: string | null = localStorage.getItem(TOKEN_KEY);

export const getAuthToken = () => _token;
export const setAuthToken = (token: string | null) => {
  _token = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};
export const clearAuthToken = () => setAuthToken(null);

export interface ApiError {
  status?: number;
  message: string;
  code?: string;
  details?: unknown;
}

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

function normalizeError(error: AxiosError): ApiError {
  const status = error.response?.status;
  const data: any = error.response?.data;
  const message =
    (data && (data.message || data.error)) ||
    (typeof data === "string" ? data : "") ||
    error.message ||
    "Request failed";
  return { status, message, code: data?.code, details: data };
}

/** When true on a request config, suppress the automatic error toast. */
declare module "axios" {
  export interface AxiosRequestConfig {
    silentError?: boolean;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError = normalizeError(error);
    const cfg: any = error.config || {};

    // 401 → token invalid/expired. Clear and bounce to login (handled by app).
    if (apiError.status === 401) {
      clearAuthToken();
      if (!location.pathname.endsWith("/login")) {
        window.dispatchEvent(new CustomEvent("cguard:unauthorized"));
      }
    }

    if (!cfg.silentError) {
      toast.error(apiError.message || "Error");
    }
    return Promise.reject(apiError);
  },
);

/** Helper: unwrap response.data with typing. */
export async function get<T>(url: string, params?: any, silentError?: boolean): Promise<T> {
  const res = await api.get<T>(url, { params, silentError });
  return res.data;
}
export async function post<T>(url: string, body?: any, silentError?: boolean): Promise<T> {
  const res = await api.post<T>(url, body, { silentError });
  return res.data;
}
export async function put<T>(url: string, body?: any, silentError?: boolean): Promise<T> {
  const res = await api.put<T>(url, body, { silentError });
  return res.data;
}
export async function del<T>(url: string, params?: any, silentError?: boolean): Promise<T> {
  const res = await api.delete<T>(url, { params, silentError });
  return res.data;
}

export default api;
