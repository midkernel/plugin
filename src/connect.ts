import { listInstallationRepos, selectRepo } from "./github-app.js";
import type { SessionStore } from "./session.js";

export type ConnectRepoInput = {
  owner?: unknown;
  name?: unknown;
};

export function connectRepo(input: ConnectRepoInput, session: SessionStore) {
  const owner = typeof input.owner === "string" ? input.owner.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!owner && !name) {
    return {
      action: "list" as const,
      selected: session.getSelectedRepo(),
      ...listInstallationRepos(),
    };
  }

  if (!owner || !name) {
    return {
      action: "select" as const,
      error: "INVALID_REPO" as const,
      message: "Pass both owner and name to select a repo, or omit both to list installation repos.",
    };
  }

  const selected = selectRepo(owner, name);
  session.setSelectedRepo(selected.selected);

  return {
    action: "select" as const,
    ...selected,
  };
}
