import { get, post } from "@/lib/api";

/**
 * Demo Control service — thin wrappers over the superadmin demo orchestrator
 * endpoints. ALL of these are hard-gated server-side to the single demo tenant
 * (requireSuperadmin + demo-tenant assertion in the handler). The frontend
 * additionally hides the page when `state.available` is false.
 *
 * Backend module: backend/src/api/superadmin/demo.ts
 *   GET  /superadmin/demo/state           -> DemoState
 *   POST /superadmin/demo/steps/:step/run -> DemoStepResult   (step = 1..7)
 *   POST /superadmin/demo/reset           -> DemoResetResult
 */

/** One of the 7 sequential operations the presenter fires during a live demo. */
export interface DemoStep {
  /** 1-based step number, drives the "Next step" ordering. */
  step: number;
  /** Short Spanish title shown in the stepper, e.g. "Relevo / entrada". */
  title: string;
  /** One-line description of the real platform action this step performs. */
  description: string;
  /** Has this step already been run in the current demo cycle? */
  done: boolean;
  /** ISO timestamp of the last successful run, if any. */
  ranAt?: string | null;
}

export interface DemoState {
  /**
   * True only when the demo tenant exists and the caller may drive it.
   * When false, the Demo Control page renders an "unavailable" notice and
   * exposes no action buttons. This is a convenience gate — the backend
   * enforces the real restriction.
   */
  available: boolean;
  /** The hard-gated demo tenant id (for display/confirmation only). */
  tenantId?: string;
  /** Human label, e.g. "Vigilancia Andina Demo". */
  tenantName?: string;
  /** 1-based number of the NEXT step to run (1 when fresh, 8 when all done). */
  currentStep: number;
  /** Total number of steps (7). */
  totalSteps: number;
  /** Full ordered step list with completion state. */
  steps: DemoStep[];
  /** ISO timestamp of the last reset / reseed. */
  lastResetAt?: string | null;
  /** Recent activity log entries, newest first. */
  log: DemoLogEntry[];
}

export interface DemoLogEntry {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Which step produced this entry (0 = reset/system). */
  step: number;
  level: "info" | "success" | "warning" | "error";
  /** Human-readable line shown in the activity panel. */
  message: string;
  /**
   * Optional structured detail (e.g. which socket event was emitted,
   * notification ids, the created visitor/incident id) for the curious.
   */
  meta?: Record<string, unknown> | null;
}

export interface DemoStepResult {
  step: number;
  title: string;
  /** New log entries appended by this run (newest first). */
  entries: DemoLogEntry[];
  /** Fresh state snapshot after the run, so the UI can advance immediately. */
  state: DemoState;
}

export interface DemoResetResult {
  ok: boolean;
  state: DemoState;
}

export const demoControlService = {
  /**
   * Fetch the current demo state. Use silentError so the page can gracefully
   * render an "unavailable" notice instead of toasting when the demo tenant
   * is not provisioned on this environment.
   */
  state: () => get<DemoState>("/superadmin/demo/state", undefined, true),

  /** Run a single step (1..7). Returns the new log lines + a fresh snapshot. */
  runStep: (step: number) =>
    post<DemoStepResult>(`/superadmin/demo/steps/${step}/run`, {}),

  /** Restore the clean seeded state so the demo can be re-run. */
  reset: () => post<DemoResetResult>("/superadmin/demo/reset", {}),
};
