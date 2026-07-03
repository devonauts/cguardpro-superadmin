import { post } from "@/lib/api";

export interface SandboxAccount {
  role: string;
  email: string;
  password: string;
  fullName: string;
}

export interface SandboxStats {
  clients: number;
  guards: number;
  stations: number;
  onDutyGuards: number;
  incidents: number;
}

export interface SandboxResult {
  tenantId: string;
  tenantName: string;
  slug: string;
  loginUrl: string;
  sharedPassword: string;
  accounts: SandboxAccount[];
  stats: SandboxStats;
  emailedTo?: string | null;
  emailSent?: boolean;
  emailError?: string | null;
}

export const sandboxesService = {
  create: (body: {
    brandName: string;
    ownerEmail?: string;
    ownerFullName?: string;
    clientCount?: number;
    sendCredentialsTo?: string;
  }) => post<SandboxResult>("/superadmin/sandboxes", body),
};
