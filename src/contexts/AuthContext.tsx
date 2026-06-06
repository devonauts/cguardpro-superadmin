import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { authService } from "@/services/auth";
import { observabilityService } from "@/services/observability";
import { setAuthToken, clearAuthToken, getAuthToken } from "@/lib/api";
import type { AuthUser } from "@/types";

const USER_KEY = "cguard_sa_user";

/** A user qualifies for the panel iff the backend marks them superadmin. */
export function isSuperadmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperadmin === true) return true;
  return (user.roles || [])
    .map((r) => String(r).toLowerCase())
    .some((r) => r === "superadmin" || r === "super_admin");
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(() => {
    clearAuthToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await authService.signIn(email, password);
    if (!isSuperadmin(u)) {
      // Never persist a token for a non-superadmin.
      const err: any = new Error(
        "This account does not have SuperAdmin access.",
      );
      err.code = "NOT_SUPERADMIN";
      throw err;
    }
    setAuthToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  // Bootstrap: with a stored token, re-verify superadmin against the backend
  // (a 200 from a guarded endpoint proves it) before trusting the cached user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await observabilityService.health(); // 401/403 if token invalid / not superadmin
        if (cancelled) return;
        const cached = localStorage.getItem(USER_KEY);
        let restored: AuthUser | null = cached ? JSON.parse(cached) : null;
        if (!restored) {
          try {
            restored = await authService.me();
          } catch {
            restored = null;
          }
        }
        setUser(restored);
      } catch {
        if (!cancelled) {
          clearAuthToken();
          localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // React to global 401s emitted by the api interceptor.
  useEffect(() => {
    const onUnauthorized = () => signOut();
    window.addEventListener("cguard:unauthorized", onUnauthorized);
    return () => window.removeEventListener("cguard:unauthorized", onUnauthorized);
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{ user, loading, isAuthenticated: !!user, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
