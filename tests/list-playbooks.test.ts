import { describe, expect, it } from "vitest";
import { listPlaybooks, type FetchLike } from "../src/playbooks.js";

function jsonResponse(status: number, body: unknown): Awaited<ReturnType<FetchLike>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("list_playbooks", () => {
  it("returns an empty list and a shell note when the registry is README + LICENSE", async () => {
    const fetchFn: FetchLike = async () =>
      jsonResponse(200, [
        { type: "file", name: "README.md", path: "README.md", html_url: "https://github.com/midkernel/playbooks/blob/main/README.md" },
        { type: "file", name: "LICENSE", path: "LICENSE", html_url: "https://github.com/midkernel/playbooks/blob/main/LICENSE" },
      ]);

    const result = await listPlaybooks({ fetch: fetchFn });
    expect(result.empty).toBe(true);
    expect(result.playbooks).toEqual([]);
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
    expect(result.playbooks).toEqual([
      {
        id: "playbooks/default.yml",
        name: "default",
        path: "playbooks/default.yml",
        url: "https://github.com/midkernel/playbooks/blob/main/playbooks/default.yml",
      },
    ]);
  });

  it("returns empty + note on fetch failure instead of inventing playbooks", async () => {
    const fetchFn: FetchLike = async () => {
      throw new Error("network down");
    };

    const result = await listPlaybooks({ fetch: fetchFn });
    expect(result.playbooks).toEqual([]);
    expect(result.empty).toBe(true);
    expect(result.note).toMatch(/network down/);
  });
});
