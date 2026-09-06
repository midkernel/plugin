import { describe, expect, it } from "vitest";
import type { FetchLike, PluginConfig } from "../src/config.js";
import { connectRepo } from "../src/connect.js";
import { SessionStore } from "../src/session.js";

const unset: PluginConfig = {
  appUrl: null,
  accessToken: null,
  githubInstallationToken: null,
  oauthClientId: null,
  oauthClientSecret: null,
};

function jsonFetch(status: number, body: unknown): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("connect_repo", () => {
  it("lists an empty installation when tokens are not available", async () => {
    const session = new SessionStore();
    const result = await connectRepo({}, session, { config: unset });

    expect(result.action).toBe("list");
    if (result.action !== "list") return;
    expect(result.stubbed).toBe(true);
    expect(result.installation).toBeNull();
    expect(result.repos).toEqual([]);
    expect(result.note).toMatch(/IT owns OAuth/i);
  });

  it("selects owner/name without claiming GitHub App verification when listing is empty", async () => {
    const session = new SessionStore();
    const result = await connectRepo({ owner: "midkernel", name: "app" }, session, { config: unset });

    expect(result.action).toBe("select");
    if (!("selected" in result)) {
      throw new Error("expected a selection");
    }
    expect(result.selected).toEqual({ owner: "midkernel", name: "app" });
    expect(result.verified).toBe(false);
    expect(session.getSelectedRepo()).toEqual({ owner: "midkernel", name: "app" });
  });

  it("rejects a partial owner/name pair", async () => {
    const result = await connectRepo({ owner: "midkernel" }, new SessionStore(), { config: unset });
    expect(result).toMatchObject({ action: "select", error: "INVALID_REPO" });
  });

  it("lists installation repos from the app when session tokens are present", async () => {
    const session = new SessionStore();
    session.setAccessToken("mk_live_test_token_ok");
    const result = await connectRepo({}, session, {
      config: {
        appUrl: "https://midkernel.com/app",
        accessToken: null,
        githubInstallationToken: null,
        oauthClientId: null,
        oauthClientSecret: null,
      },
      fetch: jsonFetch(200, {
        ok: true,
        installation: { id: "inst_1", accountLogin: "midkernel" },
        repos: [
          {
            owner: "midkernel",
            name: "app",
            url: "https://github.com/midkernel/app",
            defaultBranch: "main",
          },
        ],
      }),
    });

    expect(result.action).toBe("list");
    if (result.action !== "list") return;
    expect(result.stubbed).toBe(false);
    expect(result.mock).toBe(false);
    expect(result.repos).toEqual([
      {
        owner: "midkernel",
        name: "app",
        url: "https://github.com/midkernel/app",
        defaultBranch: "main",
      },
    ]);
    expect(result.installation).toEqual({ id: "inst_1", accountLogin: "midkernel" });
  });

  it("marks a listed repo as verified and keeps read-only semantics", async () => {
    const session = new SessionStore();
    const result = await connectRepo({ owner: "midkernel", name: "app" }, session, {
      config: {
        appUrl: "https://midkernel.com/app",
        accessToken: "mk_live_test_token_ok",
        githubInstallationToken: null,
        oauthClientId: null,
        oauthClientSecret: null,
      },
      fetch: jsonFetch(200, {
        repos: [{ owner: "midkernel", name: "app", url: "https://github.com/midkernel/app" }],
      }),
    });

    expect(result.action).toBe("select");
    if (!("verified" in result)) throw new Error("expected select");
    expect(result.verified).toBe(true);
    expect(result.note).toMatch(/read-only/i);
  });

  it("uses a GitHub installation token when the app repos route is not hosted", async () => {
    const session = new SessionStore();
    session.setGithubInstallationToken("ghs_test_install");
    const seen: string[] = [];
    const fetchFn: FetchLike = async (input) => {
      seen.push(input);
      if (input.includes("/api/repos")) {
        return {
          ok: false,
          status: 404,
          headers: { get: () => null },
          json: async () => ({ error: "not_found" }),
          text: async () => "",
        };
      }
      expect(input).toContain("https://api.github.com/installation/repositories");
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          repositories: [
            {
              name: "plugin",
              html_url: "https://github.com/midkernel/plugin",
              default_branch: "main",
              owner: { login: "midkernel" },
            },
          ],
        }),
        text: async () => "",
      };
    };

    const result = await connectRepo({}, session, {
      config: {
        appUrl: "https://midkernel.com/app",
        accessToken: "mk_live_test_token_ok",
        githubInstallationToken: null,
        oauthClientId: null,
        oauthClientSecret: null,
      },
      fetch: fetchFn,
    });

    expect(result.action).toBe("list");
    if (result.action !== "list") return;
    expect(result.source).toBe("github-installation");
    expect(result.repos).toEqual([
      {
        owner: "midkernel",
        name: "plugin",
        url: "https://github.com/midkernel/plugin",
        defaultBranch: "main",
      },
    ]);
    expect(seen.some((url) => url.includes("/api/repos"))).toBe(true);
  });
});
