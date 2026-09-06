export const ErrorCode = {
  SCAN_INFRA_UNAVAILABLE: "SCAN_INFRA_UNAVAILABLE",
  AUTH_NOT_CONFIGURED: "AUTH_NOT_CONFIGURED",
  UNAUTHORIZED: "UNAUTHORIZED",
  RUN_NOT_FOUND: "RUN_NOT_FOUND",
  INVALID_PROFILE: "INVALID_PROFILE",
  INVALID_REPO: "INVALID_REPO",
  GITHUB_APP_UNAVAILABLE: "GITHUB_APP_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const SCAN_INFRA_MESSAGE =
  "Midkernel app Scan API is not configured (set MIDKERNEL_APP_URL plus Midkernel OAuth or MIDKERNEL_API_TOKEN). This plugin will not invent a job id or pretend a run succeeded. v0 execute is the app one-shot (security-review); AWS ECS agentflow is still unissued.";

export const AUTH_NOT_CONFIGURED_MESSAGE =
  "Midkernel auth is not configured. Cursor remote MCP uses Midkernel as the authorization server (not Google). Set MIDKERNEL_API_TOKEN or complete Midkernel OAuth. This plugin will not invent a run or token.";

export const RUN_BACKEND_MESSAGE =
  "No Midkernel app run API is configured (set MIDKERNEL_APP_URL plus auth). Status and reports cannot be fetched; no findings are invented. AWS ECS agentflow is still unissued.";
