/**
 * Read-only GitHub App — STUB until IT wires OAuth + scopes.
 *
 * Tool schema: select by owner/name, or list repos visible to the installation.
 * Do not call a live GitHub App API from this package.
 *
 * TODO(IT): authenticate as the GitHub App (GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY),
 * exchange installation tokens, list real repos. Same install model as midkernel/app
 * (install fields live on Organization — no GitHubInstallation table).
 */

export type GitHubRepoRef = {
  owner: string;
  name: string;
};

export type InstallationRepo = GitHubRepoRef & {
  url: string;
  defaultBranch: string;
};

export type GitHubAppListResult = {
  stubbed: true;
  mock: true;
  installation: null;
  repos: InstallationRepo[];
  note: string;
};

export type GitHubAppSelectResult = {
  stubbed: true;
  mock: true;
  selected: GitHubRepoRef;
  verified: false;
  note: string;
};

export const GITHUB_APP_STUB_NOTE =
  "GitHub App API is stubbed. IT owns OAuth, the read-only App, and scopes. This tool defines the schema (owner/name or installation repo list) only.";

export function listInstallationRepos(): GitHubAppListResult {
  return {
    stubbed: true,
    mock: true,
    installation: null,
    repos: [],
    note: `${GITHUB_APP_STUB_NOTE} Installation repo list is empty until IT wires the App.`,
  };
}

export function selectRepo(owner: string, name: string): GitHubAppSelectResult {
  const cleanedOwner = owner.trim();
  const cleanedName = name.trim();
  if (!cleanedOwner || !cleanedName) {
    throw new Error("owner and name are required to select a repository");
  }

  return {
    stubbed: true,
    mock: true,
    selected: { owner: cleanedOwner, name: cleanedName },
    verified: false,
    note: `${GITHUB_APP_STUB_NOTE} Selection is recorded for this MCP session only; the App did not verify access.`,
  };
}

export function parseOwnerName(owner: unknown, name: unknown): GitHubRepoRef {
  if (typeof owner !== "string" || typeof name !== "string") {
    throw new Error("owner and name must be strings");
  }
  return { owner: owner.trim(), name: name.trim() };
}
