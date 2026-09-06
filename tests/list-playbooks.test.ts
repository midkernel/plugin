import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYBOOK,
  DEFAULT_PLAYBOOK_ID,
  DEFAULT_PLAYBOOK_PATH,
  listPlaybooks,
  type FetchLike,
} from "../src/playbooks.js";

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<FetchLike>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/** Recorded GitHub contents listing for midkernel/playbooks main (root security-review.md). */
const liveMainContents = JSON.parse(
  readFileSync(new URL("./fixtures/playbooks-contents-main.json", import.meta.url), "utf8"),
) as unknown[];

describe("list_playbooks", () => {
  it("pins default playbook to security-review from the public registry", () => {
    expect(DEFAULT_PLAYBOOK_ID).toBe("security-review");
    expect(DEFAULT_PLAYBOOK_PATH).toBe("security-review.md");
    expect(DEFAULT_PLAYBOOK).toEqual({
      id: "security-review",
      name: "security-review",
      path: "security-review.md",
      url: "https://github.com/midkernel/playbooks/blob/main/security-review.md",
    });
  });

  it("returns security-review from the recorded midkernel/playbooks main contents", async () => {
    const securityReviewFile = liveMainContents.find(
      (item) => typeof item === "object" && item !== null && "name" in item && item.name === "security-review.md",
    );
    expect(securityReviewFile).toMatchObject({
      type: "file",
      name: "security-review.md",
      path: "security-review.md",
    });

    const fetchFn: FetchLike = async () => jsonResponse(200, liveMainContents);
    const result = await listPlaybooks({ fetch: fetchFn });

    expect(result.empty).toBe(false);
    expect(result.note).toBeNull();
    expect(result.defaultPlaybook.id).toBe("security-review");
    expect(result.defaultPlaybook.path).toBe("security-review.md");
    expect(result.playbooks).toEqual([
      {
        id: "security-review",
        name: "security-review",
        path: "security-review.md",
        url: "https://github.com/midkernel/playbooks/blob/9ba386f1fb53535fec1c694329db5ee401fe0b74/security-review.md",
      },
    ]);
  });

  it("returns an empty list and a shell note when the registry is README + LICENSE", async () => {
    const fetchFn: FetchLike = async () =>
      jsonResponse(200, [
        { type: "file", name: "README.md", path: "README.md", html_url: "https://github.com/midkernel/playbooks/blob/main/README.md" },
        { type: "file", name: "LICENSE", path: "LICENSE", html_url: "https://github.com/midkernel/playbooks/blob/main/LICENSE" },
      ]);

    const result = await listPlaybooks({ fetch: fetchFn });
    expect(result.empty).toBe(true);
    expect(result.playbooks).toEqual([]);
    expect(result.defaultPlaybook.id).toBe("security-review");
    expect(result.note).toMatch(/still a shell/i);
  });

  it("lists playbook files when the registry is populated", async () => {
    const fetchFn: FetchLike = async (url) => {
      if (url.includes("/contents/playbooks")) {
        return jsonResponse(200, [
          {
            type: "file",
            name: "default.yml",
            path: "playbooks/default.yml",
            html_url: "https://github.com/midkernel/playbooks/blob/main/playbooks/default.yml",
          },
        ]);
      }
      return jsonResponse(200, [
        { type: "dir", name: "playbooks", path: "playbooks", url: "https://api.github.com/repos/midkernel/playbooks/contents/playbooks" },
        { type: "file", name: "README.md", path: "README.md" },
      ]);
    };

    const result = await listPlaybooks({ fetch: fetchFn });
    expect(result.empty).toBe(false);
    expect(result.defaultPlaybook.id).toBe("security-review");
    expect(result.playbooks).toEqual([
      {
        id: "playbooks/default",
        name: "default",
        path: "playbooks/default.yml",
        url: "https://github.com/midkernel/playbooks/blob/main/playbooks/default.yml",
      },
    ]);
  });

  it("prefers security-review first when other published playbooks are also present", async () => {
    const fetchFn: FetchLike = async () =>
      jsonResponse(200, [
        {
          type: "file",
          name: "other.md",
          path: "other.md",
          html_url: "https://github.com/midkernel/playbooks/blob/main/other.md",
        },
        {
          type: "file",
          name: "security-review.md",
          path: "security-review.md",
          html_url: "https://github.com/midkernel/playbooks/blob/main/security-review.md",
        },
      ]);

    const result = await listPlaybooks({ fetch: fetchFn });
    expect(result.playbooks.map((entry) => entry.id)).toEqual(["security-review", "other"]);
    expect(result.defaultPlaybook).toEqual({
      id: "security-review",
      name: "security-review",
      path: "security-review.md",
      url: "https://github.com/midkernel/playbooks/blob/main/security-review.md",
    });
  });

  it("maps app GET /api/playbooks when an app client is provided", async () => {
    const result = await listPlaybooks({
      fetch: async () => {
        throw new Error("GitHub should not be called when the app returns playbooks");
      },
      appClient: {
        listPlaybooks: async () => ({
          ok: true,
          source: "midkernel-app",
          defaultPlaybook: "security-review",
          playbooks: [
            {
              id: "pb_1",
              name: "security-review",
              slug: "security-review",
              path: "security-review.md",
              repoUrl: "https://github.com/midkernel/playbooks",
            },
          ],
        }),
      },
    });

    expect(result.empty).toBe(false);
    expect(result.playbooks.map((entry) => entry.id)).toEqual(["security-review"]);
    expect(result.defaultPlaybook.id).toBe("security-review");
  });

  it("returns empty + note on fetch failure instead of inventing playbooks", async () => {
    const fetchFn: FetchLike = async () => {
      throw new Error("network down");
    };

    const result = await listPlaybooks({ fetch: fetchFn });
    expect(result.playbooks).toEqual([]);
    expect(result.empty).toBe(true);
    expect(result.defaultPlaybook.id).toBe("security-review");
    expect(result.note).toMatch(/network down/);
  });
});
