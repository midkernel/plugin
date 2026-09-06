import { readPluginConfig, type FetchLike, type PluginConfig } from "./config.js";
import { listInstallationRepos, selectRepo, selectRepoAgainstList } from "./github-app.js";
import { connectRepoSchema } from "./schemas.js";
import type { SessionStore } from "./session.js";

export type ConnectRepoDeps = {
  config?: PluginConfig;
  fetch?: FetchLike;
};

export async function connectRepo(
  input: unknown,
  session: SessionStore,
  deps: ConnectRepoDeps = {},
) {
  const parsed = connectRepoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      action: "select" as const,
      error: "INVALID_REPO" as const,
      message: parsed.error.issues[0]?.message ?? "Invalid repository selection.",
    };
  }

  const config = deps.config ?? readPluginConfig();
  const { owner, name } = parsed.data;
  const listed = await listInstallationRepos({
    config,
    session,
    fetch: deps.fetch,
  });

  if (!owner || !name) {
    return {
      action: "list" as const,
      selected: session.getSelectedRepo(),
      ...listed,
    };
  }

  const selected =
    listed.repos.length > 0 ? selectRepoAgainstList(owner, name, listed.repos) : selectRepo(owner, name);
  session.setSelectedRepo(selected.selected);

  return {
    action: "select" as const,
    ...selected,
  };
}
