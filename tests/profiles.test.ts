import { describe, expect, it } from "vitest";
import {
  describeThreatPin,
  InvalidProfileError,
  isScanProfile,
  parseProfile,
  SCAN_PROFILES,
} from "../src/profiles.js";

describe("scan profiles", () => {
  it("enumerates exactly low, balanced, max", () => {
    expect([...SCAN_PROFILES]).toEqual(["low", "balanced", "max"]);
  });

  it("accepts each profile", () => {
    for (const profile of SCAN_PROFILES) {
      expect(isScanProfile(profile)).toBe(true);
      expect(parseProfile(profile)).toBe(profile);
    }
  });

  it("rejects threat and other strings as profiles", () => {
    for (const value of ["threat", "--threat", "high", "fast", "", "MAX", "Low"]) {
      expect(isScanProfile(value)).toBe(false);
      expect(() => parseProfile(value)).toThrow(InvalidProfileError);
    }
  });

  it("treats threat as an optional pin, not a profile", () => {
    expect(describeThreatPin("supply-chain")).toEqual({
      threat: "supply-chain",
      role: "pin",
    });
    expect(describeThreatPin("  ")).toEqual({ threat: null, role: "pin" });
    expect(describeThreatPin(undefined)).toEqual({ threat: null, role: "pin" });
  });
});
