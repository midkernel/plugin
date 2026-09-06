import { createAppClient } from "./app-client.js";
import { isScanApiConfigured, type FetchLike, type PluginConfig } from "./config.js";
import { ErrorCode } from "./errors.js";
import { repoRefSchema } from "./schemas.js";
import type { SessionStore } from "./session.js";
import type { GitHubRepoRef, InstallationRepo } from "./types.js";

export type { GitHubRepoRef, InstallationRepo };

/**
 * Read-only GitHub App listing.
 *
 * When Midkernel session/env tokens are present, list via the app
 * (`GET /api/repos`) or GitHub `GET /installation/repositories`.
 * Otherwise return an empty installation list — never invent repos.
 *
 * TODO(IT): Midkernel AS issues the plugin access token; GitHub App
 * credentials stay on midkernel/app. Same install model (install fields
 * live on Organization — no GitHubInstallation table).
 */

export type GitHubAppListResult = {
  stubbed: boolean;
  mock: boolean;
  source: "midkernel-app" | "github-installation" | "stub";
  installation: { id: string; accountLogin: string } | null;
  repos: InstallationRepo[];
  note: string;
  error?: string;
};

export type GitHubAppSelectResult = {
  stubbed: boolean;
  mock: boolean;
  selected: GitHubRepoRef;
  verified: boolean;
  note: string;
};

export const GITHUB_APP_STUB_NOTE =
  "GitHub App listing is empty until Midkernel session tokens are available. The App is read-only. IT owns OAuth and scopes.";

export const GITHUB_INSTALLATION_REPOS_URL =
  "https://api.github.com/installation/repositories?per_page=100";

export type ListInstallationDeps = {
  config: PluginConfig;
  session?: SessionStore;
  fetch?: FetchLike;
};

export async function listInstallationRepos(
  deps: ListInstallationDeps,
): Promise<GitHubAppListResult> {
  const token = deps.session?.getAccessToken() ?? deps.config.accessToken;
  const config: PluginConfig = { ...deps.config, accessToken: token ?? deps.config.accessToken };

  if (isScanApiConfigured(config)) {
    const client = createAppClient(config, deps.fetch ?? globalThis.fetch);
    const listed = await client.listRepos();
    if (listed.ok) {
      return {
        stubbed: false,
        mock: false,
        source: "midkernel-app",
        installation: listed.installation,
        repos: listed.repos,
        note: listed.note,
      };
    }
    // 404/501: agreed /api/repos is not hosted yet — try GitHub installation token.
    if (listed.status !== 404 && listed.status !== 501) {
      return {
        stubbed: true,
        mock: false,
        source: "stub",
        installation: null,
        repos: [],
        error: listed.error,
        note: listed.message,
      };
    }
  }

  const installationToken =
    deps.session?.getGithubInstallationToken() ?? deps.config.githubInstallationToken;
  if (installationToken) {
    return listGithubInstallationRepos(installationToken, deps.fetch ?? globalThis.fetch);
  }

  return {
    stubbed: true,
    mock: false,
    source: "stub",
    installation: null,
    repos: [],
    note: `${GITHUB_APP_STUB_NOTE} Installation repo list is empty until tokens are available from the Midkernel session.`,
  };
}

export async function listGithubInstallationRepos(
  installationToken: string,
  fetchFn: FetchLike,
): Promise<GitHubAppListResult> {
  try {
    const repos: InstallationRepo[] = [];
    let url: string | null = GITHUB_INSTALLATION_REPOS_URL;

    while (url) {
      const response = await fetchFn(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${installationToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "midkernel-plugin",
        },
      });
      if (!response.ok) {
        return {
          stubbed: false,
          mock: false,
          source: "github-installation",
          installation: null,
          repos: [],
          error: ErrorCode.GITHUB_APP_UNAVAILABLE,
          note: `GitHub installation listing failed (HTTP ${response.status}). No repositories were invented.`,
        };
      }
      const body = (await response.json()) as {
        repositories?: Array<{
          name?: string;
          html_url?: string;
          default_branch?: string;
          owner?: { login?: string };
        }>;
      };
      for (const repo of body.repositories ?? []) {
        if (!repo.owner?.login || !repo.name) continue;
        repos.push({
          owner: repo.owner.login,
          name: repo.name,
          url: repo.html_url ?? `https://github.com/${repo.owner.login}/${repo.name}`,
          defaultBranch: repo.default_branch ?? "main",
        });
      }
      url = nextLinkFromHeader(response.headers.get("link"));
    }

    return {
      stubbed: false,
      mock: false,
      source: "github-installation",
      installation: null,
      repos,
      note: "Repositories visible to the read-only GitHub App installation token on this session.",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      stubbed: false,
      mock: false,
      source: "github-installation",
      installation: null,
      repos: [],
      error: ErrorCode.GITHUB_APP_UNAVAILABLE,
      note: `GitHub installation listing failed (${reason}). No repositories were invented.`,
    };
  }
}

export function selectRepo(owner: string, name: string): GitHubAppSelectResult {
  const selected = repoRefSchema.parse({ owner, name });

  return {
    stubbed: true,
    mock: false,
    selected,
    verified: false,
    note: "Selection is recorded for this MCP session only. The read-only GitHub App did not verify access.",
  };
}

export function selectRepoAgainstList(
  owner: string,
  name: string,
  listed: InstallationRepo[],
): GitHubAppSelectResult {
  const selected = repoRefSchema.parse({ owner, name });
  const match = listed.find(
    (repo) =>
      repo.owner.toLowerCase() === selected.owner.toLowerCase() &&
      repo.name.toLowerCase() === selected.name.toLowerCase(),
  );

  if (!match) {
    return {
      stubbed: false,
      mock: false,
      selected,
      verified: false,
      note: `${selected.owner}/${selected.name} is not on the read-only installation list. Selection is session-only; the App did not grant access.`,
    };
  }

  return {
    stubbed: false,
    mock: false,
    selected: { owner: match.owner, name: match.name },
    verified: true,
    note: "Repository is visible to the read-only GitHub App installation.",
  };
}

export function parseOwnerName(owner: unknown, name: unknown): GitHubRepoRef {
  return repoRefSchema.parse({ owner, name });
}

function nextLinkFromHeader(link: string | null): string | null {
  if (!link) return null;
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1] ?? null;
}
