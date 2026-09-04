import { describe, expect, it } from "vitest";
import {
  connectRepoSchema,
  fetchRunSchema,
  profileSchema,
  startRunSchema,
} from "../src/schemas.js";

describe("zod input schemas", () => {
  it("accepts the three scan profiles and rejects threat as a profile", () => {
    expect(profileSchema.parse("low")).toBe("low");
    expect(profileSchema.parse("balanced")).toBe("balanced");
    expect(profileSchema.parse("max")).toBe("max");
    expect(profileSchema.safeParse("threat").success).toBe(false);
    expect(profileSchema.safeParse(1).success).toBe(false);
  });

  it("treats threat as an optional pin on start_run", () => {
    const parsed = startRunSchema.parse({
      profile: "balanced",
      threat: "  supply-chain  ",
      owner: "midkernel",
      name: "app",
    });
    expect(parsed.threat).toBe("supply-chain");
    expect(parsed.profile).toBe("balanced");
  });

  it("requires owner and name together", () => {
    expect(connectRepoSchema.safeParse({ owner: "midkernel" }).success).toBe(false);
    expect(startRunSchema.safeParse({ profile: "low", owner: "midkernel" }).success).toBe(false);
    expect(connectRepoSchema.parse({})).toEqual({ owner: undefined, name: undefined });
  });

  it("trims fetch_run ids and treats blanks as omitted", () => {
    expect(fetchRunSchema.parse({ runId: "  abc  " }).runId).toBe("abc");
    expect(fetchRunSchema.parse({ runId: "   " }).runId).toBeUndefined();
    expect(fetchRunSchema.safeParse({ runId: 12 }).success).toBe(false);
  });
});
