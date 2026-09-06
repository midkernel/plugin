import { z } from "zod";
import { ErrorCode, RUN_BACKEND_MESSAGE, SCAN_INFRA_MESSAGE } from "./errors.js";
import type { GitHubRepoRef } from "./github-app.js";
import { DEFAULT_PLAYBOOK_ID } from "./playbooks.js";
import type { ScanProfile } from "./profiles.js";
import { fetchRunSchema, startRunSchema } from "./schemas.js";
import type { SessionStore } from "./session.js";

export type CreditMeter = {
  meters: true;
  spent: false;
  note: string;
};

export type StartRunFailure = {
  ok: false;
  error: typeof ErrorCode.SCAN_INFRA_UNAVAILABLE | typeof ErrorCode.INVALID_PROFILE | typeof ErrorCode.INVALID_REPO;
  message: string;
  requested?: {
    repo: GitHubRepoRef | null;
    playbook: string;
    profile: ScanProfile;
    threat: string | null;
    threatRole: "pin";
  };
  credits: CreditMeter;
};

export type FetchRunFailure = {
  ok: false;
  error: typeof ErrorCode.SCAN_INFRA_UNAVAILABLE | typeof ErrorCode.RUN_NOT_FOUND;
  message: string;
  runId: string | null;
};

const CREDITS_NOTE =
  "Credits meter hosted Scan runs. This call did not start a run and did not spend credits. Stripe is not implemented in this plugin.";

const fakeSuccessSchema = z
  .object({
    ok: z.literal(true).optional(),
    status: z.enum(["succeeded", "success", "queued", "running"]).optional(),
    runId: z.string().min(1).optional(),
    jobId: z.string().min(1).optional(),
    externalAgentflowId: z.string().min(1).optional(),
    agentflowId: z.string().min(1).optional(),
    findings: z.array(z.unknown()).optional(),
    report: z.record(z.unknown()).optional(),
  })
  .passthrough();

function credits(): CreditMeter {
  return { meters: true, spent: false, note: CREDITS_NOTE };
}

function startRunParseError(error: z.ZodError): StartRunFailure {
  const profileIssue = error.issues.find((issue) => issue.path[0] === "profile");
  if (profileIssue) {
    return {
      ok: false,
      error: ErrorCode.INVALID_PROFILE,
      message: profileIssue.message,
      credits: credits(),
    };
  }

  return {
    ok: false,
    error: ErrorCode.INVALID_REPO,
    message: error.issues[0]?.message ?? "Invalid start_run input.",
    credits: credits(),
  };
}

export function startRun(input: unknown, session?: SessionStore): StartRunFailure {
  const parsed = startRunSchema.safeParse(input);
  if (!parsed.success) {
    return startRunParseError(parsed.error);
  }

  const { profile, threat, owner, name, playbook } = parsed.data;
  const selected = session?.getSelectedRepo() ?? null;
  const repo = owner && name ? { owner, name } : selected;

  return {
    ok: false,
    error: ErrorCode.SCAN_INFRA_UNAVAILABLE,
    message: SCAN_INFRA_MESSAGE,
    requested: {
      repo,
      playbook: playbook ?? DEFAULT_PLAYBOOK_ID,
      profile,
      threat: threat ?? null,
      threatRole: "pin",
    },
    credits: credits(),
  };
}

export function fetchRun(input: unknown = {}): FetchRunFailure {
  const parsed = fetchRunSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: ErrorCode.SCAN_INFRA_UNAVAILABLE,
      message: parsed.error.issues[0]?.message ?? RUN_BACKEND_MESSAGE,
      runId: null,
    };
  }

  const runId = parsed.data.runId ?? null;

  if (runId) {
    return {
      ok: false,
      error: ErrorCode.RUN_NOT_FOUND,
      message: `${RUN_BACKEND_MESSAGE} No run exists for id ${JSON.stringify(runId)}.`,
      runId,
    };
  }

  return {
    ok: false,
    error: ErrorCode.SCAN_INFRA_UNAVAILABLE,
    message: RUN_BACKEND_MESSAGE,
    runId: null,
  };
}

export function looksLikeFakeSuccess(payload: unknown): boolean {
  const parsed = fakeSuccessSchema.safeParse(payload);
  if (!parsed.success) return false;
  const record = parsed.data;
  if (record.ok === true) return true;
  if (record.status) return true;
  if (record.runId || record.jobId || record.externalAgentflowId || record.agentflowId) return true;
  if (record.findings) return true;
  if (record.report) return true;
  return false;
}
