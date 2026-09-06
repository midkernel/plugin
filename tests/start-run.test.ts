import { describe, expect, it } from "vitest";
import { ErrorCode } from "../src/errors.js";
import { SCAN_PROFILES } from "../src/profiles.js";
import { looksLikeFakeSuccess, startRun } from "../src/scan.js";
import { SessionStore } from "../src/session.js";

describe("start_run", () => {
  it("never returns a fake success for a valid profile", () => {
    for (const profile of SCAN_PROFILES) {
      const result = startRun({ profile });
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.SCAN_INFRA_UNAVAILABLE);
      expect(looksLikeFakeSuccess(result)).toBe(false);
      expect(result).not.toHaveProperty("runId");
      expect(result).not.toHaveProperty("jobId");
      expect(result).not.toHaveProperty("externalAgentflowId");
      expect(result).not.toHaveProperty("findings");
    }
  });

  it("rejects an invalid profile without inventing a run", () => {
    const result = startRun({ profile: "threat" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.INVALID_PROFILE);
    expect(looksLikeFakeSuccess(result)).toBe(false);
  });

  it("records threat as a pin on the requested profile", () => {
    const result = startRun({
      profile: "balanced",
      threat: "cve-2024-0000",
      owner: "midkernel",
      name: "app",
      playbook: "default",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.SCAN_INFRA_UNAVAILABLE);
    expect(result.requested).toEqual({
      repo: { owner: "midkernel", name: "app" },
      playbook: "default",
      profile: "balanced",
      threat: "cve-2024-0000",
      threatRole: "pin",
    });
    expect(result.credits).toEqual({
      meters: true,
      spent: false,
      note: expect.stringMatching(/credits meter/i),
    });
  });

  it("uses the session-selected repo when owner/name are omitted", () => {
    const session = new SessionStore();
    session.setSelectedRepo({ owner: "acme", name: "widgets" });

    const result = startRun({ profile: "low" }, session);
    expect(result.requested?.repo).toEqual({ owner: "acme", name: "widgets" });
    expect(result.error).toBe(ErrorCode.SCAN_INFRA_UNAVAILABLE);
  });

  it("does not spend credits or invent a Stripe charge", () => {
    const result = startRun({ profile: "max" });
    expect(result.credits.spent).toBe(false);
    expect(result.credits.meters).toBe(true);
    expect(result.credits.note).toMatch(/not implement/i);
    expect(result).not.toHaveProperty("checkoutUrl");
    expect(result).not.toHaveProperty("stripe");
    expect(result).not.toHaveProperty("price");
  });
});
