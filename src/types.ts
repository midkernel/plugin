export type GitHubRepoRef = {
  owner: string;
  name: string;
};

export type InstallationRepo = GitHubRepoRef & {
  url: string;
  defaultBranch: string;
};
