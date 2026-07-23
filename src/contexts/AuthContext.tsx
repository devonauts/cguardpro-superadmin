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

  // Bootstrap: render INSTANTLY from the cached user, then re-verify the token
  // against the backend in the background. Previously the whole panel was blocked
  // behind `await observabilityService.health()` before rendering anything, so any
  // network latency (or a briefly-saturated DB pool) pinned the user on a spinner.
  // Security is unchanged: every DATA endpoint still requires a valid superadmin
  // token server-side, so an optimistic render never exposes data — a revoked/
  // expired token makes the background check fail and signs the user out.
  useEffect(() => {
    let cancelled = false;
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // 1) Optimistic: trust the cached user immediately → panel is instant.
    const cached = localStorage.getItem(USER_KEY);
    let cachedUser: AuthUser | null = null;
    if (cached) {
      try {
        cachedUser = JSON.parse(cached);
      } catch {
        cachedUser = null;
      }
    }
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
    }

    // 2) Verify in the background (does not block the UI when we already rendered).
    (async () => {
      try {
        await observabilityService.health(); // 401/403 if token invalid / not superadmin
        if (cancelled) return;
        if (!cachedUser) {
          let restored: AuthUser | null = null;
          try {
            restored = await authService.me();
          } catch {
            restored = null;
          }
          if (!cancelled) setUser(restored);
        }
      } catch {
        // Token is actually invalid → sign out (ProtectedRoute redirects to login).
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
