import { describe, expect, it } from "vitest";
import type { FetchLike } from "../src/config.js";
import { GITHUB_INSTALLATION_REPOS_URL, MAX_INSTALLATION_PAGES, listGithubInstallationRepos } from "../src/github-app.js";

type Call = { url: string; authorization: string | undefined };

function pagedFetch(page: (url: string, index: number) => { repo: string; next: string | null }) {
  const calls: Call[] = [];
  const fetchFn: FetchLike = async (url, init) => {
    const { repo, next } = page(url, calls.length);
    calls.push({ url, authorization: init?.headers?.Authorization });
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (name === "link" && next ? `<${next}>; rel="next"` : null) },
      json: async () => ({ repositories: [{ name: repo, owner: { login: "acme" } }] }),
      text: async () => "",
    };
  };
  return { fetchFn, calls };
}

describe("installation repo pagination", () => {
  it("follows next links on the same origin", async () => {
    const { fetchFn, calls } = pagedFetch((_url, i) => ({
      repo: `r${i}`,
      next: i < 2 ? `https://api.github.com/installation/repositories?per_page=100&page=${i + 2}` : null,
    }));
    const result = await listGithubInstallationRepos("ghs_secret", fetchFn);
    expect(result.repos.map((repo) => repo.name)).toEqual(["r0", "r1", "r2"]);
    expect(calls).toHaveLength(3);
  });

  it("stops at the page cap and returns what it collected", async () => {
    const { fetchFn, calls } = pagedFetch((_url, i) => ({
      repo: `r${i}`,
      next: `https://api.github.com/installation/repositories?per_page=100&page=${i + 2}`,
    }));
    const result = await listGithubInstallationRepos("ghs_secret", fetchFn);
    expect(MAX_INSTALLATION_PAGES).toBe(50);
    expect(calls).toHaveLength(50);
    expect(result.repos).toHaveLength(50);
    expect(result.error).toBeUndefined();
  });

  it("does not follow a next link on another origin or send the token there", async () => {
    const { fetchFn, calls } = pagedFetch(() => ({
      repo: "first",
      next: "https://attacker.example/steal?page=2",
    }));
    const result = await listGithubInstallationRepos("ghs_secret", fetchFn);
    expect(result.repos.map((repo) => repo.name)).toEqual(["first"]);
    expect(calls).toEqual([{ url: GITHUB_INSTALLATION_REPOS_URL, authorization: "Bearer ghs_secret" }]);
  });
});
