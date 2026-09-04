import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { connectRepo } from "./connect.js";
import { listPlaybooks } from "./playbooks.js";
import { SCAN_PROFILES } from "./profiles.js";
import { fetchRun, startRun } from "./scan.js";
import { SessionStore } from "./session.js";

export const SERVER_NAME = "midkernel";
export const SERVER_VERSION = "0.1.0";

export const TOOL_NAMES = ["connect_repo", "list_playbooks", "start_run", "fetch_run"] as const;

const profileSchema = z.enum(SCAN_PROFILES);

function jsonResult(payload: unknown, isError = false) {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function createServer(session = new SessionStore()): McpServer {
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
        "The GitHub App API is stubbed in v0 (IT owns OAuth and scopes).",
      inputSchema: {
        owner: z
          .string()
          .optional()
          .describe("GitHub owner / org. Required with name to select a repo."),
        name: z
          .string()
          .optional()
          .describe("GitHub repository name. Required with owner to select a repo."),
      },
    },
    async ({ owner, name }) => {
      const result = connectRepo({ owner, name }, session);
      return jsonResult(result, "error" in result);
    },
  );

  server.registerTool(
    "list_playbooks",
    {
      description:
        "List workflows/playbooks from the public Midkernel registry (https://github.com/midkernel/playbooks). " +
        "If the registry is still a shell, returns an empty list and a note. Does not invent playbooks.",
      inputSchema: {},
    },
    async () => {
      const result = await listPlaybooks();
      return jsonResult(result);
    },
  );

  server.registerTool(
    "start_run",
    {
      description:
        "Start a Midkernel Scan run. profile is required: low | balanced | max. " +
        "threat is an optional pin (threat id or class string), not a fourth profile. " +
        "Credits meter hosted runs — mention credit spend to the user; this plugin does not implement Stripe. " +
        "Hosted execute is not issued: this tool returns SCAN_INFRA_UNAVAILABLE and does not invent job ids.",
      inputSchema: {
        profile: profileSchema.describe("Required scan profile. Not interchangeable with threat."),
        threat: z
          .string()
          .optional()
          .describe("Optional threat pin (id or class). Pins an existing profile; not a fourth profile."),
        owner: z.string().optional().describe("GitHub owner. Defaults to the repo selected via connect_repo."),
        name: z.string().optional().describe("GitHub repo name. Defaults to the repo selected via connect_repo."),
        playbook: z.string().optional().describe("Playbook/workflow id from list_playbooks."),
      },
    },
    async (args) => {
      const result = startRun(args, session);
      return jsonResult(result, true);
    },
  );

  server.registerTool(
    "fetch_run",
    {
      description:
        "Fetch status and report for a Midkernel Scan run. " +
        "Without a hosted run backend this returns SCAN_INFRA_UNAVAILABLE or RUN_NOT_FOUND. " +
        "Never invents findings, scores, or a completed report.",
      inputSchema: {
        runId: z
          .string()
          .optional()
          .describe("Run id returned by a real hosted start_run. None exist until scan infra is issued."),
      },
    },
    async ({ runId }) => {
      const result = fetchRun({ runId });
      return jsonResult(result, true);
    },
  );

  return server;
}
