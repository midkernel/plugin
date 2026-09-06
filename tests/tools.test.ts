import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "../src/server.js";

describe("v0 tool surface", () => {
  it("exposes exactly the four Scan tools", () => {
    expect([...TOOL_NAMES]).toEqual(["connect_repo", "list_playbooks", "start_run", "fetch_run"]);
  });

  it("does not register Threat Intel tools", () => {
    const names = TOOL_NAMES.join(",");
    expect(names).not.toMatch(/threat.?intel/i);
    expect(names).not.toContain("list_threats");
    expect(names).not.toContain("search_threats");
  });
});
