/**
 * HTTP client for midkernel/app Scan APIs (app PR #13).
 *
 *   POST {MIDKERNEL_APP_URL}/api/scans/start
 *   GET  {MIDKERNEL_APP_URL}/api/runs/:id
 *   GET  {MIDKERNEL_APP_URL}/api/repos   (agreed installation listing)
 *
 * Auth: Authorization: Bearer <Midkernel OAuth access token or MIDKERNEL_API_TOKEN>.
 * Never invents a successful run, findings, or report.
 */

import { joinAppUrl, type FetchLike, type PluginConfig } from "./config.js";
import { ErrorCode } from "./errors.js";
import type { ScanProfile } from "./profiles.js";
import type { GitHubRepoRef, InstallationRepo } from "./types.js";

export const APP_PATHS = {
  startScan: "/api/scans/start",
  run: (id: string) => `/api/runs/${encodeURIComponent(id)}`,
  repos: "/api/repos",
} as const;

export const PLUGIN_USER_AGENT = "midkernel-plugin/0.1";

export type AppHttpError = {
  ok: false;
  error: string;
  message: string;
  status: number;
  runId?: string | null;
};

export type StartScanSuccess = {
  ok: true;
  source: "midkernel-app";
  runId: string;
  scanId: string | null;
  projectId: string | null;
  playbook: string;
  profile: ScanProfile;
  threat: string | null;
  status: string;
  credits: { meters: true; spent: number | false; balanceAfter: number | null; note: string };
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

export type ListReposSuccess = {
  ok: true;
  source: "midkernel-app";
  stubbed: false;
  mock: false;
  installation: { id: string; accountLogin: string } | null;
  repos: InstallationRepo[];
  note: string;
};

export type AppClient = {
  startScan: (input: {
    owner: string;
    name: string;
    profile: ScanProfile;
    playbook: string;
    threat: string | null;
  }) => Promise<StartScanSuccess | AppHttpError>;
  fetchRun: (runId: string) => Promise<FetchRunSuccess | AppHttpError>;
  listRepos: () => Promise<ListReposSuccess | AppHttpError>;
};

const CREDITS_SPENT_NOTE =
  "Credits meter hosted Scan runs. Stripe is not implemented in this plugin.";

function emptyHeaders(): { get: (name: string) => string | null } {
  return { get: () => null };
}

function asFetchLike(fetchFn: typeof fetch | FetchLike): FetchLike {
  return async (input, init) => {
    const response = await fetchFn(input, init);
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers ?? emptyHeaders(),
      json: () => response.json(),
      text: () => response.text(),
    };
  };
}

function bearerHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "User-Agent": PLUGIN_USER_AGENT,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapAppError(status: number, body: unknown, fallback: string): AppHttpError {
  const record = asRecord(body);
  const error = asString(record?.error) ?? fallbackError(status);
  const message = asString(record?.message) ?? fallback;
  return { ok: false, error, message, status };
}

function fallbackError(status: number): string {
  if (status === 401 || status === 403) return ErrorCode.UNAUTHORIZED;
  if (status === 404) return ErrorCode.RUN_NOT_FOUND;
  if (status === 402) return "insufficient_credits";
  if (status >= 500) return ErrorCode.SCAN_INFRA_UNAVAILABLE;
  return "app_error";
}

async function readJsonBody(response: { json: () => Promise<unknown>; text: () => Promise<string> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      const text = await response.text();
      return text ? { message: text } : null;
    } catch {
      return null;
    }
  }
}

export function createAppClient(
  config: Pick<PluginConfig, "appUrl" | "accessToken">,
  fetchFn: FetchLike | typeof fetch = globalThis.fetch,
): AppClient {
  const http = asFetchLike(fetchFn);

  if (!config.appUrl || !config.accessToken) {
    throw new Error("createAppClient requires MIDKERNEL_APP_URL and a Midkernel access token.");
  }

  const appUrl = config.appUrl;
  const token = config.accessToken;

  return {
    async startScan(input) {
      const url = joinAppUrl(appUrl, APP_PATHS.startScan);
      try {
        const response = await http(url, {
          method: "POST",
          headers: {
            ...bearerHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            owner: input.owner,
            name: input.name,
            profile: input.profile,
            playbook: input.playbook,
            threat: input.threat,
          }),
        });
        const body = await readJsonBody(response);
        if (!response.ok) {
          return mapAppError(response.status, body, `Start scan failed (HTTP ${response.status}).`);
        }
        return mapStartSuccess(body, input);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          error: ErrorCode.SCAN_INFRA_UNAVAILABLE,
          message: `Could not reach Midkernel app Scan API (${reason}). No run was invented.`,
          status: 0,
        };
      }
    },

    async fetchRun(runId) {
      const url = joinAppUrl(appUrl, APP_PATHS.run(runId));
      try {
        const response = await http(url, {
          method: "GET",
          headers: bearerHeaders(token),
        });
        const body = await readJsonBody(response);
        if (!response.ok) {
          const mapped = mapAppError(response.status, body, `Fetch run failed (HTTP ${response.status}).`);
          return { ...mapped, runId };
        }
        return mapFetchSuccess(body, runId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          error: ErrorCode.SCAN_INFRA_UNAVAILABLE,
          message: `Could not reach Midkernel app run API (${reason}). No findings were invented.`,
          status: 0,
          runId,
        };
      }
    },

    async listRepos() {
      const url = joinAppUrl(appUrl, APP_PATHS.repos);
      try {
        const response = await http(url, {
          method: "GET",
          headers: bearerHeaders(token),
        });
        const body = await readJsonBody(response);
        if (response.status === 404 || response.status === 501) {
          return {
            ok: false,
            error: ErrorCode.GITHUB_APP_UNAVAILABLE,
            message: `Installation repo listing is not hosted yet (${url} → HTTP ${response.status}).`,
            status: response.status,
          };
        }
        if (!response.ok) {
          return mapAppError(response.status, body, `Repo listing failed (HTTP ${response.status}).`);
        }
        return mapReposSuccess(body);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          error: ErrorCode.GITHUB_APP_UNAVAILABLE,
          message: `Could not reach Midkernel app repo listing (${reason}).`,
          status: 0,
        };
      }
    },
  };
}

function mapStartSuccess(
  body: unknown,
  input: { playbook: string; profile: ScanProfile; threat: string | null },
): StartScanSuccess | AppHttpError {
  const record = asRecord(body);
  const runId = asString(record?.runId);
  if (!record || !runId || record.ok === false) {
    return {
      ok: false,
      error: "invalid_app_response",
      message: "App start response did not include a runId. No run was invented.",
      status: 502,
    };
  }

  const creditsRecord = asRecord(record.credits);
  const spent = asNumber(creditsRecord?.spent);

  return {
    ok: true,
    source: "midkernel-app",
    runId,
    scanId: asString(record.scanId),
    projectId: asString(record.projectId),
    playbook: asString(record.playbook) ?? input.playbook,
    profile: input.profile,
    threat: asString(record.threat) ?? input.threat,
    status: asString(record.status) ?? "pending",
    credits: {
      meters: true,
      spent: spent ?? false,
      balanceAfter: asNumber(creditsRecord?.balanceAfter),
      note: CREDITS_SPENT_NOTE,
    },
  };
}

function mapFetchSuccess(body: unknown, runId: string): FetchRunSuccess | AppHttpError {
  const record = asRecord(body);
  const id = asString(record?.id) ?? asString(record?.runId) ?? runId;
  if (!record || record.ok === false || !asString(record.status)) {
    return {
      ok: false,
      error: "invalid_app_response",
      message: "App run response was missing status. No findings were invented.",
      status: 502,
      runId,
    };
  }

  const report = mapReport(record.report);
  const scan = mapScan(record.scan);

  return {
    ok: true,
    source: "midkernel-app",
    runId: id,
    status: asString(record.status)!,
    outcome: record.outcome === "succeeded" || record.outcome === "failed" ? record.outcome : null,
    startedAt: asString(record.startedAt),
    finishedAt: asString(record.finishedAt),
    events: Array.isArray(record.events) ? record.events : [],
    profile:
      record.profile === "low" || record.profile === "balanced" || record.profile === "max"
        ? record.profile
        : null,
    threat: asString(record.threat),
    playbook: mapPlaybook(record.playbook),
    project: mapProject(record.project),
    scan,
    report,
    credits: { meters: true },
  };
}

function mapReport(value: unknown): FetchRunSuccess["report"] {
  const record = asRecord(value);
  const text = asString(record?.text);
  if (!record || !text) return null;
  return {
    summary: asString(record.summary) ?? text.slice(0, 280),
    text,
    findingsCount: asNumber(record.findingsCount),
    model: asString(record.model),
  };
}

function mapScan(value: unknown): FetchRunSuccess["scan"] {
  const record = asRecord(value);
  const id = asString(record?.id);
  const status = asString(record?.status);
  if (!record || !id || !status) return null;
  return {
    id,
    status,
    summary: asString(record.summary),
    findingsCount: asNumber(record.findingsCount),
  };
}

function mapPlaybook(value: unknown): FetchRunSuccess["playbook"] {
  const record = asRecord(value);
  const slug = asString(record?.slug);
  const name = asString(record?.name);
  if (!slug || !name) return null;
  return { slug, name };
}

function mapProject(value: unknown): FetchRunSuccess["project"] {
  const record = asRecord(value);
  const name = asString(record?.name);
  const githubOwner = asString(record?.githubOwner);
  const githubName = asString(record?.githubName);
  if (!name || !githubOwner || !githubName) return null;
  return { name, githubOwner, githubName };
}

function mapReposSuccess(body: unknown): ListReposSuccess | AppHttpError {
  const record = asRecord(body);
  const rawRepos = Array.isArray(record?.repos)
    ? record.repos
    : Array.isArray(record?.repositories)
      ? record.repositories
      : null;
  if (!rawRepos) {
    return {
      ok: false,
      error: ErrorCode.GITHUB_APP_UNAVAILABLE,
      message: "App repo listing did not include repos. No repositories were invented.",
      status: 502,
    };
  }

  const repos: InstallationRepo[] = [];
  for (const item of rawRepos) {
    const mapped = mapRepo(item);
    if (mapped) repos.push(mapped);
  }

  const installationRecord = asRecord(record?.installation);
  const installationId = asString(installationRecord?.id);
  const accountLogin = asString(installationRecord?.accountLogin);

  return {
    ok: true,
    source: "midkernel-app",
    stubbed: false,
    mock: false,
    installation: installationId && accountLogin ? { id: installationId, accountLogin } : null,
    repos,
    note: "Repositories visible to the read-only Midkernel GitHub App installation.",
  };
}

function mapRepo(value: unknown): InstallationRepo | null {
  const record = asRecord(value);
  if (!record) return null;
  const owner =
    asString(record.owner) ??
    asString(asRecord(record.owner)?.login) ??
    asString(record.githubOwner);
  const name = asString(record.name) ?? asString(record.githubName);
  if (!owner || !name) return null;
  return {
    owner,
    name,
    url: asString(record.url) ?? asString(record.html_url) ?? `https://github.com/${owner}/${name}`,
    defaultBranch: asString(record.defaultBranch) ?? asString(record.default_branch) ?? "main",
  };
}

export function repoRefEquals(left: GitHubRepoRef, right: GitHubRepoRef): boolean {
  return left.owner.toLowerCase() === right.owner.toLowerCase() && left.name.toLowerCase() === right.name.toLowerCase();
}
