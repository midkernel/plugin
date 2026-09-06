import { z } from "zod";
import { createAppClient, type AppClient } from "./app-client.js";
import {
  hasAppAuth,
  hasAppUrl,
  isScanApiConfigured,
  readPluginConfig,
  type FetchLike,
  type PluginConfig,
} from "./config.js";
import {
  AUTH_NOT_CONFIGURED_MESSAGE,
  ErrorCode,
  RUN_BACKEND_MESSAGE,
  SCAN_INFRA_MESSAGE,
} from "./errors.js";
import type { GitHubRepoRef } from "./types.js";
import { authNotConfigured } from "./oauth.js";
import { DEFAULT_PLAYBOOK_ID } from "./playbooks.js";
import type { ScanProfile } from "./profiles.js";
import { fetchRunSchema, startRunSchema } from "./schemas.js";
import type { SessionStore } from "./session.js";

export type CreditMeter = {
  meters: true;
  spent: number | false;
  balanceAfter?: number | null;
  note: string;
};

export type StartRunRequested = {
  repo: GitHubRepoRef | null;
  playbook: string;
  profile: ScanProfile;
  threat: string | null;
  threatRole: "pin";
};

export type StartRunFailure = {
  ok: false;
  error: string;
  message: string;
  requested?: StartRunRequested;
  credits: CreditMeter;
  runId?: string | null;
};

export type StartRunSuccess = {
  ok: true;
  source: "midkernel-app";
  runId: string;
  scanId: string | null;
  projectId: string | null;
  playbook: string;
  profile: ScanProfile;
  threat: string | null;
  status: string;
  requested: StartRunRequested;
  credits: CreditMeter;
};

export type FetchRunFailure = {
  ok: false;
  error: string;
  message: string;
  runId: string | null;
};

export type FetchRunSuccess = {
  ok: true;
  source: "midkernel-app";
  runId: string;
  status: string;
  outcome: "succeeded" | "failed" | null;
  startedAt: string | null;
  finishedAt: string | null;
  events: unknown[];
  profile: ScanProfile | null;
  threat: string | null;
  playbook: { slug: string; name: string } | null;
  project: { name: string; githubOwner: string; githubName: string } | null;
  scan: {
    id: string;
    status: string;
    summary: string | null;
    findingsCount: number | null;
  } | null;
  report: {
    summary: string;
    text: string;
    findingsCount: number | null;
    model: string | null;
  } | null;
  credits: { meters: true };
};

export type ScanDeps = {
  config?: PluginConfig;
  fetch?: FetchLike;
  client?: AppClient;
};

const CREDITS_NOTE =
  "Credits meter hosted Scan runs. This call did not start a run and did not spend credits. Stripe is not implemented in this plugin.";

const fakeLocalSuccessSchema = z
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

function resolveConfig(session: SessionStore | undefined, deps: ScanDeps): PluginConfig {
  const base = deps.config ?? readPluginConfig();
  return {
    ...base,
    accessToken: session?.getAccessToken() ?? base.accessToken,
    githubInstallationToken: session?.getGithubInstallationToken() ?? base.githubInstallationToken,
  };
}

function resolveClient(config: PluginConfig, deps: ScanDeps): AppClient {
  return deps.client ?? createAppClient(config, deps.fetch ?? globalThis.fetch);
}

export async function startRun(
  input: unknown,
  session?: SessionStore,
  deps: ScanDeps = {},
): Promise<StartRunSuccess | StartRunFailure> {
  const parsed = startRunSchema.safeParse(input);
  if (!parsed.success) {
    return startRunParseError(parsed.error);
  }

  const { profile, threat, owner, name, playbook } = parsed.data;
  const selected = session?.getSelectedRepo() ?? null;
  const repo = owner && name ? { owner, name } : selected;
  const requested: StartRunRequested = {
    repo,
    playbook: playbook ?? DEFAULT_PLAYBOOK_ID,
    profile,
    threat: threat ?? null,
    threatRole: "pin",
  };

  const config = resolveConfig(session, deps);

  if (!hasAppUrl(config)) {
    return {
      ok: false,
      error: ErrorCode.SCAN_INFRA_UNAVAILABLE,
      message: SCAN_INFRA_MESSAGE,
      requested,
      credits: credits(),
    };
  }

  if (!hasAppAuth(config)) {
    const auth = authNotConfigured();
    return {
      ok: false,
      error: auth.error,
      message: auth.message,
      requested,
      credits: credits(),
    };
  }

  if (!repo) {
    return {
      ok: false,
      error: ErrorCode.INVALID_REPO,
      message: "Select a repository with connect_repo or pass owner and name.",
      requested,
      credits: credits(),
    };
  }

  const result = await resolveClient(config, deps).startScan({
    owner: repo.owner,
    name: repo.name,
    profile,
    playbook: requested.playbook,
    threat: requested.threat,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      message: result.message,
      requested,
      credits: credits(),
      runId: result.runId ?? null,
    };
  }

  return {
    ok: true,
    source: "midkernel-app",
    runId: result.runId,
    scanId: result.scanId,
    projectId: result.projectId,
    playbook: result.playbook,
    profile: result.profile,
    threat: result.threat,
    status: result.status,
    requested,
    credits: result.credits,
  };
}

export async function fetchRun(
  input: unknown = {},
  session?: SessionStore,
  deps: ScanDeps = {},
): Promise<FetchRunSuccess | FetchRunFailure> {
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
  const config = resolveConfig(session, deps);

  if (!hasAppUrl(config)) {
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

  if (!hasAppAuth(config)) {
    return {
      ok: false,
      error: ErrorCode.AUTH_NOT_CONFIGURED,
      message: AUTH_NOT_CONFIGURED_MESSAGE,
      runId,
    };
  }

  if (!runId) {
    return {
      ok: false,
      error: ErrorCode.RUN_NOT_FOUND,
      message: "runId is required to fetch a Midkernel Scan run. No findings were invented.",
      runId: null,
    };
  }

  const result = await resolveClient(config, deps).fetchRun(runId);
  if (!result.ok) {
    return {
      ok: false,
      error: result.status === 404 ? ErrorCode.RUN_NOT_FOUND : result.error,
      message: result.message,
      runId,
    };
  }

  return result;
}

/**
 * True when a payload looks like a locally invented success (job ids,
 * findings, or ok:true without `source: "midkernel-app"`). Real mapped
 * HTTP results from the app set that source and are not fake.
 */
export function looksLikeFakeSuccess(payload: unknown): boolean {
  const parsed = fakeLocalSuccessSchema.safeParse(payload);
  if (!parsed.success) return false;
  const record = parsed.data as Record<string, unknown>;
  if (record.source === "midkernel-app") return false;
  if (record.ok === true) return true;
  if (record.status) return true;
  if (record.runId || record.jobId || record.externalAgentflowId || record.agentflowId) return true;
  if (record.findings) return true;
  if (record.report) return true;
  return false;
}

export function assertScanApiReady(config: PluginConfig): boolean {
  return isScanApiConfigured(config);
}
