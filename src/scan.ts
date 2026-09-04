import { ErrorCode, RUN_BACKEND_MESSAGE, SCAN_INFRA_MESSAGE } from "./errors.js";
import type { GitHubRepoRef } from "./github-app.js";
import { describeThreatPin, parseProfile, type ScanProfile } from "./profiles.js";
import type { SessionStore } from "./session.js";

export type StartRunInput = {
  profile: unknown;
  threat?: unknown;
  owner?: unknown;
  name?: unknown;
  playbook?: unknown;
};

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
    playbook: string | null;
    profile: ScanProfile;
    threat: string | null;
    threatRole: "pin";
  };
  credits: CreditMeter;
};

export type FetchRunInput = {
  runId?: unknown;
};

export type FetchRunFailure = {
  ok: false;
  error: typeof ErrorCode.SCAN_INFRA_UNAVAILABLE | typeof ErrorCode.RUN_NOT_FOUND;
  message: string;
  runId: string | null;
};

const CREDITS_NOTE =
  "Credits meter hosted Scan runs. This call did not start a run and did not spend credits. Stripe is not implemented in this plugin.";

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function startRun(input: StartRunInput, session?: SessionStore): StartRunFailure {
  let profile: ScanProfile;
  try {
    profile = parseProfile(input.profile);
  } catch (error) {
    return {
      ok: false,
      error: ErrorCode.INVALID_PROFILE,
      message: error instanceof Error ? error.message : String(error),
      credits: { meters: true, spent: false, note: CREDITS_NOTE },
    };
  }

  const threat = describeThreatPin(asOptionalString(input.threat));
  const owner = asOptionalString(input.owner);
  const name = asOptionalString(input.name);
  const selected = session?.getSelectedRepo() ?? null;

  let repo: GitHubRepoRef | null = null;
  if (owner || name) {
    if (!owner || !name) {
      return {
        ok: false,
        error: ErrorCode.INVALID_REPO,
        message: "To target a repo, pass both owner and name (or select one with connect_repo first).",
        credits: { meters: true, spent: false, note: CREDITS_NOTE },
      };
    }
    repo = { owner, name };
  } else if (selected) {
    repo = selected;
  }

  return {
    ok: false,
    error: ErrorCode.SCAN_INFRA_UNAVAILABLE,
    message: SCAN_INFRA_MESSAGE,
    requested: {
      repo,
      playbook: asOptionalString(input.playbook) ?? null,
      profile,
      threat: threat.threat,
      threatRole: "pin",
    },
    credits: { meters: true, spent: false, note: CREDITS_NOTE },
  };
}

export function fetchRun(input: FetchRunInput = {}): FetchRunFailure {
  const runId = asOptionalString(input.runId) ?? null;

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
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;

  if (record.ok === true) return true;
  if (record.status === "succeeded" || record.status === "success" || record.status === "queued" || record.status === "running") {
    return true;
  }

  const forbiddenIds = ["runId", "jobId", "externalAgentflowId", "agentflowId"];
  for (const key of forbiddenIds) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return true;
  }

  if (Array.isArray(record.findings)) return true;
  if (record.report && typeof record.report === "object") return true;

  return false;
}
