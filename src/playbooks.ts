export const DEFAULT_PLAYBOOKS_REPO_URL = "https://github.com/midkernel/playbooks";
export const DEFAULT_PLAYBOOKS_CONTENTS_URL =
  "https://api.github.com/repos/midkernel/playbooks/contents";

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
  empty: boolean;
  note: string | null;
};

export type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

type GithubContentItem = {
  type?: string;
  name?: string;
  path?: string;
  html_url?: string;
  url?: string;
};

function isShellName(name: string): boolean {
  return SHELL_BASENAMES.has(name.toLowerCase());
}

function hasPlaybookExtension(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return PLAYBOOK_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

function asItems(value: unknown): GithubContentItem[] {
  return Array.isArray(value) ? (value as GithubContentItem[]) : [];
}

export async function listPlaybooks(options?: {
  fetch?: FetchLike;
  contentsUrl?: string;
  repoUrl?: string;
}): Promise<ListPlaybooksResult> {
  const repoUrl = options?.repoUrl ?? DEFAULT_PLAYBOOKS_REPO_URL;
  const contentsUrl = options?.contentsUrl ?? DEFAULT_PLAYBOOKS_CONTENTS_URL;
  const fetchFn = options?.fetch ?? globalThis.fetch;

  try {
    const items = await walkContents(fetchFn, contentsUrl, 0);
    const playbooks = items
      .filter((item) => item.type === "file" && item.name && !isShellName(item.name) && hasPlaybookExtension(item.name))
      .map((item) => ({
        id: item.path ?? item.name ?? "",
        name: (item.name ?? item.path ?? "").replace(/\.(ya?ml|md|json)$/i, ""),
        path: item.path ?? item.name ?? "",
        url: item.html_url ?? `${repoUrl}/blob/main/${item.path ?? item.name}`,
      }))
      .filter((entry) => entry.id.length > 0);

    if (playbooks.length === 0) {
      return {
        registry: repoUrl,
        playbooks: [],
        empty: true,
        note: `Public registry ${repoUrl} is still a shell. No workflows/playbooks are published yet.`,
      };
    }

    return {
      registry: repoUrl,
      playbooks,
      empty: false,
      note: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      registry: repoUrl,
      playbooks: [],
      empty: true,
      note: `Could not read public registry ${repoUrl} (${reason}). Returning an empty list; no playbooks invented.`,
    };
  }
}

async function walkContents(
  fetchFn: FetchLike,
  url: string,
  depth: number,
): Promise<GithubContentItem[]> {
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

  const items = asItems(await response.json());
  const collected: GithubContentItem[] = [];

  for (const item of items) {
    if (item.type === "file") {
      collected.push(item);
      continue;
    }
    if (item.type === "dir" && typeof item.url === "string") {
      const name = (item.name ?? "").toLowerCase();
      if (name === "playbooks" || name === "workflows" || name === "registry") {
        collected.push(...(await walkContents(fetchFn, item.url, depth + 1)));
      }
    }
  }

  return collected;
}
