import { post, get } from "@/lib/api";
import type { AuthUser, SignInResponse } from "@/types";

export const authService = {
  signIn: (email: string, password: string) =>
    post<SignInResponse>("/auth/sign-in", { email, password }, true),
  me: () => get<AuthUser>("/auth/me", undefined, true),
};
