export const ErrorCode = {
  SCAN_INFRA_UNAVAILABLE: "SCAN_INFRA_UNAVAILABLE",
  RUN_NOT_FOUND: "RUN_NOT_FOUND",
  INVALID_PROFILE: "INVALID_PROFILE",
  INVALID_REPO: "INVALID_REPO",
  GITHUB_APP_UNAVAILABLE: "GITHUB_APP_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const SCAN_INFRA_MESSAGE =
  "Scan infrastructure is not issued. This plugin will not start a hosted run, invent a job id, or pretend agentflow executed.";

export const RUN_BACKEND_MESSAGE =
  "No hosted run backend is available. Status and reports cannot be fetched; no findings are invented.";
