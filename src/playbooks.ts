import type { AppClient } from "./app-client.js";
import { githubContentsSchema, githubDirSchema, type GithubContents } from "./schemas.js";

export const DEFAULT_PLAYBOOKS_REPO_URL = "https://github.com/midkernel/playbooks";
export const DEFAULT_PLAYBOOKS_CONTENTS_URL =
  "https://api.github.com/repos/midkernel/playbooks/contents";

/** Public registry slug / start_run id. Path is the root file on midkernel/playbooks main. */
export const DEFAULT_PLAYBOOK_ID = "security-review";
export const DEFAULT_PLAYBOOK_PATH = "security-review.md";

export const DEFAULT_PLAYBOOK = {
  id: DEFAULT_PLAYBOOK_ID,
  name: DEFAULT_PLAYBOOK_ID,
  path: DEFAULT_PLAYBOOK_PATH,
  url: `${DEFAULT_PLAYBOOKS_REPO_URL}/blob/main/${DEFAULT_PLAYBOOK_PATH}`,
} as const;

const SHELL_BASENAMES = new Set(["readme.md", "readme", "license", "license.md", "license.txt"]);

const PLAYBOOK_EXTENSIONS = new Set([".yml", ".yaml", ".md", ".json"]);

export type PlaybookEntry = {
  id: string;
  name: string;
  path: string;
  url: string;
};

export type ListPlaybooksResult = {
  registry: string;
  playbooks: PlaybookEntry[];
  defaultPlaybook: PlaybookEntry;
  empty: boolean;
  note: string | null;
};

export type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

function isShellName(name: string): boolean {
  return SHELL_BASENAMES.has(name.toLowerCase());
}

function hasPlaybookExtension(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return PLAYBOOK_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

function stripPlaybookExtension(value: string): string {
  return value.replace(/\.(ya?ml|md|json)$/i, "");
}

function playbookIdFromPath(path: string): string {
  return stripPlaybookExtension(path);
}

export function isDefaultPlaybook(entry: Pick<PlaybookEntry, "id" | "name" | "path">): boolean {
  return (
    entry.id === DEFAULT_PLAYBOOK_ID ||
    entry.name === DEFAULT_PLAYBOOK_ID ||
    entry.path === DEFAULT_PLAYBOOK_PATH
  );
}

function sortDefaultFirst(playbooks: PlaybookEntry[]): PlaybookEntry[] {
  return [...playbooks].sort((a, b) => {
    const aDefault = isDefaultPlaybook(a) ? 0 : 1;
    const bDefault = isDefaultPlaybook(b) ? 0 : 1;
    if (aDefault !== bDefault) return aDefault - bDefault;
    return a.id.localeCompare(b.id);
  });
}

function resolveDefaultPlaybook(playbooks: PlaybookEntry[]): PlaybookEntry {
  return playbooks.find(isDefaultPlaybook) ?? { ...DEFAULT_PLAYBOOK };
}

function parseContents(value: unknown) {
  return githubContentsSchema.parse(value);
}

export async function listPlaybooks(options?: {
  fetch?: FetchLike;
  contentsUrl?: string;
  repoUrl?: string;
  appClient?: Pick<AppClient, "listPlaybooks">;
}): Promise<ListPlaybooksResult> {
  const repoUrl = options?.repoUrl ?? DEFAULT_PLAYBOOKS_REPO_URL;
  const contentsUrl = options?.contentsUrl ?? DEFAULT_PLAYBOOKS_CONTENTS_URL;
  const fetchFn = options?.fetch ?? globalThis.fetch;

  if (options?.appClient) {
    const fromApp = await options.appClient.listPlaybooks();
    if (fromApp.ok && fromApp.playbooks.length > 0) {
      const playbooks = sortDefaultFirst(
        fromApp.playbooks.map((entry) => ({
          id: entry.slug,
          name: entry.name,
          path: entry.path ?? `${entry.slug}.md`,
          url: entry.repoUrl ?? `${repoUrl}/blob/main/${entry.path ?? `${entry.slug}.md`}`,
        })),
      );
      return {
        registry: repoUrl,
        playbooks,
        defaultPlaybook: resolveDefaultPlaybook(playbooks),
        empty: false,
        note: null,
      };
    }
  }

  try {
    const items = await walkContents(fetchFn, contentsUrl, 0);
    const playbooks = sortDefaultFirst(
      items
        .filter((item) => item.type === "file" && item.name && !isShellName(item.name) && hasPlaybookExtension(item.name))
        .map((item) => {
          const path = item.path ?? item.name ?? "";
          const filename = item.name ?? item.path ?? "";
          return {
            id: playbookIdFromPath(path),
            name: stripPlaybookExtension(filename),
            path,
            url: item.html_url ?? `${repoUrl}/blob/main/${path}`,
          };
        })
        .filter((entry) => entry.id.length > 0),
    );

    if (playbooks.length === 0) {
      return {
        registry: repoUrl,
        playbooks: [],
        defaultPlaybook: { ...DEFAULT_PLAYBOOK },
        empty: true,
        note: `Public registry ${repoUrl} is still a shell. No workflows/playbooks are published yet.`,
      };
    }

    return {
      registry: repoUrl,
      playbooks,
      defaultPlaybook: resolveDefaultPlaybook(playbooks),
      empty: false,
      note: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      registry: repoUrl,
      playbooks: [],
      defaultPlaybook: { ...DEFAULT_PLAYBOOK },
      empty: true,
      note: `Could not read public registry ${repoUrl} (${reason}). Returning an empty list; no playbooks invented.`,
    };
  }
}

async function walkContents(
  fetchFn: FetchLike,
  url: string,
  depth: number,
): Promise<GithubContents> {
  if (depth > 3) return [];

  const response = await fetchFn(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "midkernel-plugin",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub contents HTTP ${response.status}`);
  }

  const items = parseContents(await response.json());
  const collected: GithubContents = [];

  for (const item of items) {
    if (item.type === "file") {
      collected.push(item);
      continue;
    }
    const dir = githubDirSchema.safeParse(item);
    if (!dir.success) continue;
    const name = (dir.data.name ?? "").toLowerCase();
    if (name === "playbooks" || name === "workflows" || name === "registry") {
      collected.push(...(await walkContents(fetchFn, dir.data.url, depth + 1)));
    }
  }

  return collected;
}
