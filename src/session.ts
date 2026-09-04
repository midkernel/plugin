import type { GitHubRepoRef } from "./github-app.js";

/** In-memory selection for one stdio MCP process. Not a hosted account. */
export class SessionStore {
  private selectedRepo: GitHubRepoRef | null = null;

  getSelectedRepo(): GitHubRepoRef | null {
    return this.selectedRepo;
  }

  setSelectedRepo(repo: GitHubRepoRef): GitHubRepoRef {
    this.selectedRepo = { owner: repo.owner, name: repo.name };
    return this.selectedRepo;
  }

  clear(): void {
    this.selectedRepo = null;
  }
}

export const session = new SessionStore();
