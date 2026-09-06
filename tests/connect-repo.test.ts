import { describe, expect, it } from "vitest";
import { connectRepo } from "../src/connect.js";
import { SessionStore } from "../src/session.js";

describe("connect_repo", () => {
  it("lists a stubbed empty installation when owner/name are omitted", () => {
    const session = new SessionStore();
    const result = connectRepo({}, session);

    expect(result.action).toBe("list");
    if (result.action !== "list") return;
    expect(result.stubbed).toBe(true);
    expect(result.installation).toBeNull();
    expect(result.repos).toEqual([]);
    expect(result.note).toMatch(/IT owns OAuth/i);
  });

  it("selects owner/name without claiming GitHub App verification", () => {
    const session = new SessionStore();
    const result = connectRepo({ owner: "midkernel", name: "app" }, session);

    expect(result.action).toBe("select");
    if (!("selected" in result)) {
      throw new Error("expected a selection");
    }
    expect(result.selected).toEqual({ owner: "midkernel", name: "app" });
    expect(result.verified).toBe(false);
    expect(session.getSelectedRepo()).toEqual({ owner: "midkernel", name: "app" });
  });

  it("rejects a partial owner/name pair", () => {
    const result = connectRepo({ owner: "midkernel" }, new SessionStore());
    expect(result).toMatchObject({ action: "select", error: "INVALID_REPO" });
  });
});
