import { listInstallationRepos, selectRepo } from "./github-app.js";
import { connectRepoSchema } from "./schemas.js";
import type { SessionStore } from "./session.js";

export function connectRepo(input: unknown, session: SessionStore) {
  const parsed = connectRepoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      action: "select" as const,
      error: "INVALID_REPO" as const,
      message: parsed.error.issues[0]?.message ?? "Invalid repository selection.",
    };
  }

  const { owner, name } = parsed.data;

  if (!owner || !name) {
    return {
      action: "list" as const,
      selected: session.getSelectedRepo(),
      ...listInstallationRepos(),
    };
  }

  const selected = selectRepo(owner, name);
  session.setSelectedRepo(selected.selected);

  return {
    action: "select" as const,
    ...selected,
  };
}
