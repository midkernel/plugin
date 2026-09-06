import { describe, expect, it } from "vitest";
import type { FetchLike, PluginConfig } from "../src/config.js";
import { ErrorCode } from "../src/errors.js";
import { fetchRun, looksLikeFakeSuccess } from "../src/scan.js";

const unset: PluginConfig = {
  appUrl: null,
  accessToken: null,
  githubInstallationToken: null,
  oauthClientId: null,
  oauthClientSecret: null,
};

const configured: PluginConfig = {
  appUrl: "https://midkernel.com/app",
  accessToken: "mk_live_test_token_ok",
  githubInstallationToken: null,
  oauthClientId: null,
  oauthClientSecret: null,
};

function jsonFetch(status: number, body: unknown, expectedUrl?: string): FetchLike {
  return async (input) => {
    if (expectedUrl) expect(input).toBe(expectedUrl);
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
}

describe("fetch_run without app URL/auth", () => {
  it("returns unavailable when no run id is given", async () => {
    const result = await fetchRun({}, undefined, { config: unset });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.SCAN_INFRA_UNAVAILABLE);
    expect(result.runId).toBeNull();
    expect(result).not.toHaveProperty("findings");
    expect(result).not.toHaveProperty("report");
  });

  it("returns not found for any requested id and invents no findings", async () => {
    const result = await fetchRun({ runId: "looks-real-job-123" }, undefined, { config: unset });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.RUN_NOT_FOUND);
    expect(result.runId).toBe("looks-real-job-123");
    expect(result).not.toHaveProperty("findings");
    expect(result).not.toHaveProperty("status");
    expect(JSON.stringify(result)).not.toMatch(/critical|high|medium|low finding/i);
  });

  it("returns AUTH_NOT_CONFIGURED when URL is set but auth is missing", async () => {
    const result = await fetchRun(
      { runId: "run_1" },
      undefined,
      { config: { ...configured, accessToken: null } },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.AUTH_NOT_CONFIGURED);
    expect(looksLikeFakeSuccess(result)).toBe(false);
  });
});

describe("fetch_run with mocked app HTTP", () => {
  it("maps status without a report when the model has not finished", async () => {
    const result = await fetchRun({ runId: "run_pending" }, undefined, {
      config: configured,
      fetch: jsonFetch(
        200,
        {
          ok: true,
          id: "run_pending",
          status: "pending",
          outcome: null,
          startedAt: null,
          finishedAt: null,
          events: [{ at: "2026-09-06T00:00:00.000Z", type: "queued", message: "Queued" }],
          profile: "low",
          threat: null,
          playbook: { slug: "security-review", name: "security-review" },
          project: { name: "app", githubOwner: "midkernel", githubName: "app" },
          scan: { id: "scan_1", status: "pending", summary: null, findingsCount: null },
          report: null,
          credits: { meters: true },
        },
        "https://midkernel.com/app/api/runs/run_pending",
      ),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected mapped run");
    expect(result.source).toBe("midkernel-app");
    expect(result.status).toBe("pending");
    expect(result.report).toBeNull();
    expect(result).not.toHaveProperty("findings");
    expect(looksLikeFakeSuccess(result)).toBe(false);
  });

  it("maps a report only when the app provided model text", async () => {
    const result = await fetchRun({ runId: "run_done" }, undefined, {
      config: configured,
      fetch: jsonFetch(200, {
        ok: true,
        id: "run_done",
        status: "completed",
        outcome: "succeeded",
        startedAt: "2026-09-06T00:00:00.000Z",
        finishedAt: "2026-09-06T00:01:00.000Z",
        events: [],
        profile: "balanced",
        threat: null,
        playbook: { slug: "security-review", name: "security-review" },
        project: { name: "app", githubOwner: "midkernel", githubName: "app" },
        scan: { id: "scan_1", status: "completed", summary: "Authz gap", findingsCount: 1 },
        report: {
          summary: "Authz gap",
          text: "Authz gap in src/api.ts\nFindings: 1",
          findingsCount: 1,
          model: "openai/gpt-5.4",
        },
        credits: { meters: true },
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected report");
    expect(result.report?.text).toContain("Authz gap");
    expect(result.report?.findingsCount).toBe(1);
    expect(result.outcome).toBe("succeeded");
  });

  it("maps 404 to RUN_NOT_FOUND without inventing a report", async () => {
    const result = await fetchRun({ runId: "missing" }, undefined, {
      config: configured,
      fetch: jsonFetch(404, { ok: false, error: "run_not_found", message: "Run not found." }),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.RUN_NOT_FOUND);
    expect(result).not.toHaveProperty("report");
  });
});
