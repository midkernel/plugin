import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createAppClient } from "./app-client.js";
import { isScanApiConfigured, readPluginConfig } from "./config.js";
import { connectRepo } from "./connect.js";
import { listPlaybooks } from "./playbooks.js";
import { fetchRun, startRun } from "./scan.js";
import { connectRepoSchema, fetchRunSchema, listPlaybooksSchema, startRunSchema } from "./schemas.js";
import { SessionStore } from "./session.js";

export const SERVER_NAME = "midkernel";
export const SERVER_VERSION = "0.1.0";

export const TOOL_NAMES = ["connect_repo", "list_playbooks", "start_run", "fetch_run"] as const;

function jsonResult(payload: unknown, isError = false) {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function createServer(session = new SessionStore()): McpServer {
  const config = readPluginConfig();
  if (config.accessToken) session.setAccessToken(config.accessToken);
  if (config.githubInstallationToken) {
    session.setGithubInstallationToken(config.githubInstallationToken);
  }

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "connect_repo",
    {
      description:
        "Connect or select a GitHub repository for Midkernel Scan. " +
        "Pass owner + name to select a repo, or omit both to list repos visible to the read-only GitHub App installation. " +
        "When Midkernel session tokens are present, lists installation repos via the app (or GitHub installation API). " +
        "The GitHub App is read-only.",
      inputSchema: connectRepoSchema,
    },
    async (args) => {
      const result = await connectRepo(args, session);
      return jsonResult(result, "error" in result);
    },
  );

  server.registerTool(
    "list_playbooks",
    {
      description:
        "List workflows/playbooks from midkernel/app GET /api/playbooks when auth is configured, " +
        "else the public Midkernel registry (https://github.com/midkernel/playbooks). " +
        "Default playbook is security-review (path security-review.md). " +
        "If the registry is still a shell, returns an empty list and a note. Does not invent playbooks.",
      inputSchema: listPlaybooksSchema,
    },
    async () => {
      const live = readPluginConfig();
      const token = session.getAccessToken() ?? live.accessToken;
      const configured = { ...live, accessToken: token };
      const appClient = isScanApiConfigured(configured)
        ? createAppClient(configured)
        : undefined;
      const result = await listPlaybooks({ appClient });
      return jsonResult(result);
    },
  );

  server.registerTool(
    "start_run",
    {
      description:
        "Start a Midkernel Scan run via the midkernel/app HTTP API. profile is required: low | balanced | max. " +
        "When playbook is omitted, uses security-review from the public registry. " +
        "threat is an optional pin (threat id or class string), not a fourth profile. " +
        "Credits meter hosted runs — mention credit spend to the user; this plugin does not implement Stripe. " +
        "Requires MIDKERNEL_APP_URL plus Midkernel OAuth or MIDKERNEL_API_TOKEN. " +
        "Does not invent job ids or findings. Hosted Production Scan is live (app HTTP → native ECS agentflow → report.md); local without auth fails closed.",
      inputSchema: startRunSchema,
    },
    async (args) => {
      const result = await startRun(args, session);
      return jsonResult(result, !result.ok);
    },
  );

  server.registerTool(
    "fetch_run",
    {
      description:
        "Fetch status and report for a Midkernel Scan run from midkernel/app GET /api/runs/:id. " +
        "Requires MIDKERNEL_APP_URL plus auth. Returns AUTH_NOT_CONFIGURED or RUN_NOT_FOUND when missing. " +
        "Never invents findings, scores, or a completed report. Report is present only after a real model pass.",
      inputSchema: fetchRunSchema,
    },
    async (args) => {
      const result = await fetchRun(args, session);
      return jsonResult(result, !result.ok);
    },
  );

  return server;
}
