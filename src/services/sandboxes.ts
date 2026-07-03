import { post } from "@/lib/api";

export interface SandboxAccount {
  role: string;
  email: string;
  password: string;
  fullName: string;
}

export interface SandboxResult {
  tenantId: string;
  tenantName: string;
  slug: string;
  loginUrl: string;
  sharedPassword: string;
  accounts: SandboxAccount[];
  emailedTo?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
}

export const sandboxesService = {
  create: (body: {
    brandName: string;
    ownerEmail?: string;
    ownerFullName?: string;
    sendCredentialsTo?: string;
  }) => post<SandboxResult>("/superadmin/sandboxes", body),
};
