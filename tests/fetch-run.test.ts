import { describe, expect, it } from "vitest";
import { ErrorCode } from "../src/errors.js";
import { fetchRun } from "../src/scan.js";

describe("fetch_run", () => {
  it("returns unavailable when no run id is given", () => {
    const result = fetchRun({});
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.SCAN_INFRA_UNAVAILABLE);
    expect(result.runId).toBeNull();
    expect(result).not.toHaveProperty("findings");
    expect(result).not.toHaveProperty("report");
  });

  it("returns not found for any requested id and invents no findings", () => {
    const result = fetchRun({ runId: "looks-real-job-123" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.RUN_NOT_FOUND);
    expect(result.runId).toBe("looks-real-job-123");
    expect(result).not.toHaveProperty("findings");
    expect(result).not.toHaveProperty("status");
    expect(JSON.stringify(result)).not.toMatch(/critical|high|medium|low finding/i);
  });
});
