/**
 * Plugin runtime config. Midkernel app HTTP + Midkernel-as-AS OAuth.
 * Placeholder env values are treated as unset — never used as live credentials.
 */

export const PLACEHOLDER_PREFIX = "PLACEHOLDER_";

export type PluginConfig = {
  appUrl: string | null;
  accessToken: string | null;
  githubInstallationToken: string | null;
  oauthClientId: string | null;
  oauthClientSecret: string | null;
};

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export function isPlaceholderEnvValue(value: string | undefined | null): boolean {
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith(PLACEHOLDER_PREFIX)) return true;
  if (trimmed.startsWith("${") && trimmed.endsWith("}")) return true;
  return false;
}

export function readEnvValue(
  names: string[],
  env: Record<string, string | undefined> = process.env,
): string | null {
  for (const name of names) {
    const value = env[name];
    if (!isPlaceholderEnvValue(value)) {
      return value!.trim();
    }
  }
  return null;
}

/** Strip trailing slashes so `/api/...` joins cleanly. */
export function normalizeAppUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

export function joinAppUrl(baseUrl: string, path: string): string {
  const base = normalizeAppUrl(baseUrl);
  if (!base) {
    throw new Error("MIDKERNEL_APP_URL is required to build an app URL.");
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function readPluginConfig(
  env: Record<string, string | undefined> = process.env,
): PluginConfig {
  return {
    appUrl: normalizeAppUrl(readEnvValue(["MIDKERNEL_APP_URL", "SCAN_API_URL"], env)),
    accessToken: readEnvValue(["MIDKERNEL_API_TOKEN", "SCAN_API_TOKEN"], env),
    githubInstallationToken: readEnvValue(
      ["GITHUB_INSTALLATION_TOKEN", "MIDKERNEL_GITHUB_INSTALLATION_TOKEN"],
      env,
    ),
    oauthClientId: readEnvValue(["MIDKERNEL_OAUTH_CLIENT_ID"], env),
    oauthClientSecret: readEnvValue(["MIDKERNEL_OAUTH_CLIENT_SECRET"], env),
  };
}

export function hasAppUrl(config: PluginConfig): boolean {
  return Boolean(config.appUrl);
}

export function hasAppAuth(config: PluginConfig): boolean {
  return Boolean(config.accessToken);
}

export function isScanApiConfigured(config: PluginConfig): boolean {
  return hasAppUrl(config) && hasAppAuth(config);
}
