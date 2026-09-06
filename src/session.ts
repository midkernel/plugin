import type { GitHubRepoRef } from "./types.js";

/** In-memory selection + tokens for one MCP process. Not a hosted account. */
export class SessionStore {
  private selectedRepo: GitHubRepoRef | null = null;
  private accessToken: string | null = null;
  private githubInstallationToken: string | null = null;

  getSelectedRepo(): GitHubRepoRef | null {
    return this.selectedRepo;
  }

  setSelectedRepo(repo: GitHubRepoRef): GitHubRepoRef {
    this.selectedRepo = { owner: repo.owner, name: repo.name };
    return this.selectedRepo;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token && token.trim() ? token.trim() : null;
  }

  getGithubInstallationToken(): string | null {
    return this.githubInstallationToken;
  }

  setGithubInstallationToken(token: string | null): void {
    this.githubInstallationToken = token && token.trim() ? token.trim() : null;
  }

  clear(): void {
    this.selectedRepo = null;
    this.accessToken = null;
    this.githubInstallationToken = null;
  }
}

export const session = new SessionStore();
