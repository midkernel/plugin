import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppClient } from "../src/app-client.js";
import type { FetchLike } from "../src/config.js";

const config = { appUrl: "https://app.example.test", accessToken: "tok" };

function abortableNeverResolves(): FetchLike {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
}

describe("app client request timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(
        () => controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError")),
        ms,
      );
      return controller.signal;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("ends a request that never resolves after 30 s with the unreachable result", async () => {
    const client = createAppClient(config, abortableNeverResolves());
    let settled = false;
    const pending = client.fetchRun("run_1").then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(29_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({
      ok: false,
      error: "SCAN_INFRA_UNAVAILABLE",
      message: "Could not reach Midkernel app run API (timed out after 30 s). No findings were invented.",
      status: 0,
      runId: "run_1",
    });
  });

  it("treats a timeout while reading the body as unreachable", async () => {
    const stalledBody: FetchLike = (_input, init) =>
      Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
        text: () => Promise.reject(new TypeError("Body is unusable")),
      } as unknown as Response);
    const client = createAppClient(config, stalledBody);
    const pending = client.fetchRun("run_1");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toEqual({
      ok: false,
      error: "SCAN_INFRA_UNAVAILABLE",
      message: "Could not reach Midkernel app run API (timed out after 30 s). No findings were invented.",
      status: 0,
      runId: "run_1",
    });
  });

  it("applies the timeout to every client method", async () => {
    const client = createAppClient(config, abortableNeverResolves());
    const results = Promise.all([
      client.startScan({ owner: "o", name: "n", profile: "balanced", playbook: "security-review", threat: null }),
      client.listRepos(),
      client.listPlaybooks(),
    ]);
    await vi.advanceTimersByTimeAsync(30_000);
    const [start, repos, playbooks] = await results;
    expect(start).toMatchObject({ ok: false, status: 0, error: "SCAN_INFRA_UNAVAILABLE" });
    expect(start.ok === false && start.message).toContain("timed out after 30 s");
    expect(repos).toMatchObject({ ok: false, status: 0, error: "GITHUB_APP_UNAVAILABLE" });
    expect(playbooks).toMatchObject({ ok: false, status: 0, error: "SCAN_INFRA_UNAVAILABLE" });
  });
});

describe("app client failure results", () => {
  it("keeps the unreachable message for a thrown fetch error", async () => {
    const client = createAppClient(config, async () => {
      throw new Error("connect ECONNREFUSED");
    });
    expect(await client.listPlaybooks()).toEqual({
      ok: false,
      error: "SCAN_INFRA_UNAVAILABLE",
      message: "Could not reach Midkernel app playbooks API (connect ECONNREFUSED). No playbooks were invented.",
      status: 0,
    });
  });

  it("maps a non-OK status and an unparsable body", async () => {
    const client = createAppClient(config, async () => ({
      ok: false,
      status: 502,
      headers: { get: () => null },
      json: async () => {
        throw new Error("not json");
      },
      text: async () => "bad gateway",
    }));
    expect(await client.fetchRun("r")).toEqual({
      ok: false,
      error: "SCAN_INFRA_UNAVAILABLE",
      message: "bad gateway",
      status: 502,
      runId: "r",
    });
  });
});
