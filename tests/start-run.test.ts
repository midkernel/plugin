import { describe, expect, it } from "vitest";
import type { FetchLike, PluginConfig } from "../src/config.js";
import { ErrorCode } from "../src/errors.js";
import { SCAN_PROFILES } from "../src/profiles.js";
import { looksLikeFakeSuccess, startRun } from "../src/scan.js";
import { SessionStore } from "../src/session.js";

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

function jsonFetch(
  handler: (input: string, init?: { method?: string; body?: string }) => { status: number; body: unknown },
): FetchLike {
  return async (input, init) => {
    const result = handler(input, init);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      headers: { get: () => null },
      json: async () => result.body,
      text: async () => JSON.stringify(result.body),
    };
  };
}

describe("start_run without app URL/auth", () => {
  it("never returns a fake success for a valid profile", async () => {
    for (const profile of SCAN_PROFILES) {
      const result = await startRun({ profile }, undefined, { config: unset });
      expect(result.ok).toBe(false);
      expect(result.error).toBe(ErrorCode.SCAN_INFRA_UNAVAILABLE);
      expect(looksLikeFakeSuccess(result)).toBe(false);
      expect(result).not.toHaveProperty("runId");
      expect(result).not.toHaveProperty("jobId");
      expect(result).not.toHaveProperty("externalAgentflowId");
      expect(result).not.toHaveProperty("findings");
    }
  });

  it("rejects an invalid profile without inventing a run", async () => {
    const result = await startRun({ profile: "threat" }, undefined, { config: unset });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.INVALID_PROFILE);
    expect(looksLikeFakeSuccess(result)).toBe(false);
  });

  it("records threat as a pin on the requested profile", async () => {
    const result = await startRun(
      {
        profile: "balanced",
        threat: "cve-2024-0000",
        owner: "midkernel",
        name: "app",
        playbook: "default",
      },
      undefined,
      { config: unset },
    );

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

  it("uses security-review when the user does not name a playbook", async () => {
    const result = await startRun({ profile: "balanced" }, undefined, { config: unset });
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.SCAN_INFRA_UNAVAILABLE);
    expect(result.requested?.playbook).toBe("security-review");
    expect(looksLikeFakeSuccess(result)).toBe(false);
  });

  it("uses the session-selected repo when owner/name are omitted", async () => {
    const session = new SessionStore();
    session.setSelectedRepo({ owner: "acme", name: "widgets" });

    const result = await startRun({ profile: "low" }, session, { config: unset });
    expect(result.requested?.repo).toEqual({ owner: "acme", name: "widgets" });
    expect(result.requested?.playbook).toBe("security-review");
    expect(result.error).toBe(ErrorCode.SCAN_INFRA_UNAVAILABLE);
  });

  it("does not spend credits or invent a Stripe charge", async () => {
    const result = await startRun({ profile: "max" }, undefined, { config: unset });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.credits.spent).toBe(false);
      expect(result.credits.meters).toBe(true);
      expect(result.credits.note).toMatch(/not implement/i);
    }
    expect(result).not.toHaveProperty("checkoutUrl");
    expect(result).not.toHaveProperty("stripe");
    expect(result).not.toHaveProperty("price");
  });

  it("returns AUTH_NOT_CONFIGURED when the app URL is set but auth is missing", async () => {
    const result = await startRun(
      { profile: "low", owner: "midkernel", name: "app" },
      undefined,
      { config: { ...configured, accessToken: null } },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe(ErrorCode.AUTH_NOT_CONFIGURED);
    expect(looksLikeFakeSuccess(result)).toBe(false);
  });
});

describe("start_run with mocked app HTTP", () => {
  it("maps a real app start response and does not invent findings", async () => {
    const fetchFn = jsonFetch((url, init) => {
      expect(url).toBe("https://midkernel.com/app/api/scans/start");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
      expect(body).toMatchObject({
        owner: "midkernel",
        name: "app",
        profile: "balanced",
        playbook: "security-review",
        threat: "web2.authz-idor",
      });
      return {
        status: 201,
        body: {
          ok: true,
          runId: "run_real_1",
          scanId: "scan_1",
          projectId: "proj_1",
          playbook: "security-review",
          profile: "balanced",
          threat: "web2.authz-idor",
          status: "pending",
          credits: { meters: true, spent: 25, balanceAfter: 55 },
        },
      };
    });

    const result = await startRun(
      { profile: "balanced", owner: "midkernel", name: "app", threat: "web2.authz-idor" },
      undefined,
      { config: configured, fetch: fetchFn },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected mapped success");
    expect(result.source).toBe("midkernel-app");
    expect(result.runId).toBe("run_real_1");
    expect(result.credits.spent).toBe(25);
    expect(result.credits.meters).toBe(true);
    expect(result).not.toHaveProperty("findings");
    expect(looksLikeFakeSuccess(result)).toBe(false);
  });

  it("maps app validation errors without spending credits or inventing a run id", async () => {
    const fetchFn = jsonFetch(() => ({
      status: 400,
      body: { ok: false, error: "invalid_playbook", message: "v0 one-shot execute only supports playbook security-review." },
    }));

    const result = await startRun(
      { profile: "low", owner: "midkernel", name: "app", playbook: "threat-intel" },
      undefined,
      { config: configured, fetch: fetchFn },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_playbook");
    expect(result).not.toHaveProperty("findings");
    if (!result.ok) {
      expect(result.credits.spent).toBe(false);
    }
    expect(looksLikeFakeSuccess(result)).toBe(false);
  });

  it("does not treat an ok:true body without runId as success", async () => {
    const fetchFn = jsonFetch(() => ({
      status: 200,
      body: { ok: true, status: "succeeded", findings: [{ severity: "critical" }] },
    }));

    const result = await startRun(
      { profile: "max", owner: "midkernel", name: "app" },
      undefined,
      { config: configured, fetch: fetchFn },
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_app_response");
    expect(JSON.stringify(result)).not.toMatch(/critical/);
  });
});
