import { describe, expect, it } from "vitest";
import { APP_PATHS } from "../src/app-client.js";
import {
  isPlaceholderEnvValue,
  isScanApiConfigured,
  joinAppUrl,
  readPluginConfig,
} from "../src/config.js";

describe("plugin config", () => {
  it("treats PLACEHOLDER_ and empty values as unset", () => {
    expect(isPlaceholderEnvValue("PLACEHOLDER_MIDKERNEL_APP_URL")).toBe(true);
    expect(isPlaceholderEnvValue("${MIDKERNEL_APP_URL}")).toBe(true);
    expect(isPlaceholderEnvValue("")).toBe(true);
    expect(isPlaceholderEnvValue("https://midkernel.com/app")).toBe(false);
  });

  it("prefers MIDKERNEL_APP_URL and MIDKERNEL_API_TOKEN over aliases", () => {
    const config = readPluginConfig({
      MIDKERNEL_APP_URL: "https://midkernel.com/app/",
      SCAN_API_URL: "https://ignored.example",
      MIDKERNEL_API_TOKEN: "mk_live_test_token_ok",
      SCAN_API_TOKEN: "ignored",
    });
    expect(config.appUrl).toBe("https://midkernel.com/app");
    expect(config.accessToken).toBe("mk_live_test_token_ok");
    expect(isScanApiConfigured(config)).toBe(true);
  });

  it("joins Scan API paths onto the app base URL", () => {
    expect(joinAppUrl("https://midkernel.com/app", "/api/scans/start")).toBe(
      "https://midkernel.com/app/api/scans/start",
    );
    expect(joinAppUrl("https://midkernel.com/app/", "api/runs/abc")).toBe(
      "https://midkernel.com/app/api/runs/abc",
    );
  });

  it("pins Scan HTTP paths to the app contract", () => {
    expect(APP_PATHS.startScan).toBe("/api/scans/start");
    expect(APP_PATHS.run("run_1")).toBe("/api/runs/run_1");
    expect(APP_PATHS.repos).toBe("/api/repos");
    expect(APP_PATHS.playbooks).toBe("/api/playbooks");
  });
});
