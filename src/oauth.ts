/**
 * Midkernel-as-AS client for Cursor remote MCP.
 *
 * Cursor's IdP for this connector is Midkernel — not Google. Google remains
 * the app's own user sign-in. Cursor discovers these URLs via RFC 8414 /
 * RFC 9728 metadata the app hosts. If those AS routes are not live yet,
 * helpers return AUTH_NOT_CONFIGURED and never invent a token or run.
 *
 * App AS paths (prefix MIDKERNEL_APP_URL; production includes Next basePath
 * `/app`, e.g. https://midkernel.com/app) — match midkernel/app oauthMetadata:
 *   GET  /.well-known/oauth-authorization-server
 *   GET  /.well-known/oauth-protected-resource
 *   GET  /oauth/authorize
 *   POST /api/oauth/token
 *   POST /api/oauth/register
 *   MCP  /mcp
 * Revoke is not hosted — do not require /oauth/revoke.
 *
 * When discovery succeeds, authorize/token/register URLs come from metadata.
 * Hardcoded paths are fallbacks only. Never invent endpoints.
 *
 * IT production redirect allowlist (exact):
 *   https://www.cursor.com/agents/mcp/oauth/callback
 *   https://www.cursor.com/bot/mcp/oauth/callback
 * DCR may also accept localhost / cursor:// / vscode://; those are
 * optional and not required on the production allowlist. Do not invent
 * other redirect URIs.
 */

import { joinAppUrl, type FetchLike } from "./config.js";
import { AUTH_NOT_CONFIGURED_MESSAGE, ErrorCode } from "./errors.js";

export const MIDKERNEL_AS_IDP = "midkernel" as const;

export const MIDKERNEL_AS_PATHS = {
  authorize: "/oauth/authorize",
  token: "/api/oauth/token",
  register: "/api/oauth/register",
  metadata: "/.well-known/oauth-authorization-server",
  protectedResource: "/.well-known/oauth-protected-resource",
  mcp: "/mcp",
} as const;

export const MIDKERNEL_AS_SCOPES = ["scan"] as const;

/** IT-confirmed production allowlist. Exact URIs only. */
export const CURSOR_MCP_REDIRECT_URIS = [
  "https://www.cursor.com/agents/mcp/oauth/callback",
  "https://www.cursor.com/bot/mcp/oauth/callback",
] as const;

/**
 * DCR defaults the app may accept locally. Not on the IT production allowlist.
 * Schemes only — do not invent concrete callback paths.
 */
export const OAUTH_DCR_OPTIONAL_REDIRECT_SCHEMES = [
  "http://localhost",
  "cursor:",
  "vscode:",
] as const;

export type MidkernelAsUrls = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  /** App does not host revoke. Null unless metadata advertises one. */
  revocation_endpoint: string | null;
  mcp_endpoint: string;
  metadata_url: string;
  protected_resource_url: string;
};

export type AuthNotConfigured = {
  ok: false;
  error: typeof ErrorCode.AUTH_NOT_CONFIGURED;
  message: string;
};

export type AuthorizationRequest = {
  url: string;
  authorization_endpoint: string;
  client_id: string;
  redirect_uri: string;
  response_type: "code";
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: "S256";
  resource: string;
};

export type TokenSuccess = {
  ok: true;
  token_type: string;
  access_token: string;
  expires_in: number | null;
  refresh_token: string | null;
  scope: string | null;
};

export function midkernelAsUrls(appUrl: string): MidkernelAsUrls {
  return {
    issuer: appUrl.replace(/\/+$/, ""),
    authorization_endpoint: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.authorize),
    token_endpoint: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.token),
    registration_endpoint: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.register),
    revocation_endpoint: null,
    mcp_endpoint: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.mcp),
    metadata_url: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.metadata),
    protected_resource_url: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.protectedResource),
  };
}

function asEndpoint(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Overlay discovered RFC 8414 endpoints onto fallbacks.
 * Required authorize/token must be present. Register uses metadata when
 * present, else the agreed fallback. Revoke is optional — never invented.
 */
export function urlsFromMetadata(
  fallback: MidkernelAsUrls,
  metadata: Record<string, unknown>,
): MidkernelAsUrls | AuthNotConfigured {
  const authorization_endpoint = asEndpoint(metadata.authorization_endpoint);
  const token_endpoint = asEndpoint(metadata.token_endpoint);
  if (!authorization_endpoint || !token_endpoint) {
    return authNotConfigured("Authorization server metadata is missing authorize/token endpoints.");
  }
  if (isGoogleIdpUrl(authorization_endpoint) || isGoogleIdpUrl(token_endpoint)) {
    return authNotConfigured("Google is not the Cursor IdP for Midkernel remote MCP.");
  }

  const registration_endpoint = asEndpoint(metadata.registration_endpoint);
  const revocation_endpoint = asEndpoint(metadata.revocation_endpoint);

  return {
    ...fallback,
    issuer: asEndpoint(metadata.issuer) ?? fallback.issuer,
    authorization_endpoint,
    token_endpoint,
    registration_endpoint: registration_endpoint ?? fallback.registration_endpoint,
    revocation_endpoint,
  };
}

export function authorizationServerMetadataDocument(appUrl: string): Record<string, unknown> {
  const urls = midkernelAsUrls(appUrl);
  return {
    issuer: urls.issuer,
    authorization_endpoint: urls.authorization_endpoint,
    token_endpoint: urls.token_endpoint,
    registration_endpoint: urls.registration_endpoint,
    // revocation_endpoint omitted — app does not host revoke.
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: [...MIDKERNEL_AS_SCOPES],
    // Midkernel is the AS. Do not list Google as the Cursor IdP.
    idp: MIDKERNEL_AS_IDP,
  };
}

export function protectedResourceMetadataDocument(appUrl: string): Record<string, unknown> {
  const urls = midkernelAsUrls(appUrl);
  return {
    resource: urls.issuer,
    authorization_servers: [urls.issuer],
    scopes_supported: [...MIDKERNEL_AS_SCOPES],
    bearer_methods_supported: ["header"],
  };
}

export function authNotConfigured(detail?: string): AuthNotConfigured {
  return {
    ok: false,
    error: ErrorCode.AUTH_NOT_CONFIGURED,
    message: detail ? `${AUTH_NOT_CONFIGURED_MESSAGE} ${detail}` : AUTH_NOT_CONFIGURED_MESSAGE,
  };
}

export function isGoogleIdpUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "accounts.google.com" || host.endsWith(".google.com") || host === "google.com";
  } catch {
    return /accounts\.google\.com/i.test(value);
  }
}

export function buildAuthorizationRequest(input: {
  appUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource?: string;
  scope?: string;
  urls?: MidkernelAsUrls;
}): AuthorizationRequest | AuthNotConfigured {
  if (!input.clientId.trim()) {
    return authNotConfigured("MIDKERNEL_OAUTH_CLIENT_ID is not set.");
  }
  if (isGoogleIdpUrl(input.appUrl) || isGoogleIdpUrl(input.redirectUri)) {
    return authNotConfigured("Google is not the Cursor IdP for Midkernel remote MCP.");
  }

  const urls = input.urls ?? midkernelAsUrls(input.appUrl);
  if (isGoogleIdpUrl(urls.authorization_endpoint)) {
    return authNotConfigured("Google is not the Cursor IdP for Midkernel remote MCP.");
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scope ?? MIDKERNEL_AS_SCOPES.join(" "),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    resource: input.resource ?? urls.mcp_endpoint,
  });

  return {
    url: `${urls.authorization_endpoint}?${params.toString()}`,
    authorization_endpoint: urls.authorization_endpoint,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: input.scope ?? MIDKERNEL_AS_SCOPES.join(" "),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    resource: input.resource ?? urls.mcp_endpoint,
  };
}

export async function discoverAuthorizationServer(
  appUrl: string,
  fetchFn: FetchLike,
): Promise<{ ok: true; metadata: Record<string, unknown>; urls: MidkernelAsUrls } | AuthNotConfigured> {
  const fallback = midkernelAsUrls(appUrl);
  try {
    const response = await fetchFn(fallback.metadata_url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "midkernel-plugin" },
    });
    if (response.status === 404 || response.status === 501) {
      return authNotConfigured(
        `Authorization server metadata is not hosted yet (${fallback.metadata_url} → HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      return authNotConfigured(
        `Authorization server metadata request failed (HTTP ${response.status}).`,
      );
    }
    const metadata = (await response.json()) as Record<string, unknown>;
    const urls = urlsFromMetadata(fallback, metadata);
    if ("error" in urls) return urls;
    return { ok: true, metadata, urls };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return authNotConfigured(`Authorization server is not reachable (${reason}).`);
  }
}

export async function exchangeAuthorizationCode(
  input: {
    appUrl: string;
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
    clientSecret?: string | null;
    /** Prefer discovered metadata.token_endpoint when present. */
    tokenEndpoint?: string;
    urls?: MidkernelAsUrls;
  },
  fetchFn: FetchLike,
): Promise<TokenSuccess | AuthNotConfigured> {
  if (!input.clientId.trim() || !input.code.trim()) {
    return authNotConfigured("OAuth client id and authorization code are required.");
  }

  const fallback = midkernelAsUrls(input.appUrl);
  const tokenEndpoint = input.tokenEndpoint ?? input.urls?.token_endpoint ?? fallback.token_endpoint;
  if (isGoogleIdpUrl(tokenEndpoint)) {
    return authNotConfigured("Google is not the Cursor IdP for Midkernel remote MCP.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.codeVerifier,
  });
  if (input.clientSecret) {
    body.set("client_secret", input.clientSecret);
  }

  try {
    const response = await fetchFn(tokenEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "midkernel-plugin",
      },
      body: body.toString(),
    });

    if (response.status === 404 || response.status === 501) {
      return authNotConfigured(
        `Token endpoint is not hosted yet (${tokenEndpoint} → HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      return authNotConfigured(`Token exchange failed (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as {
      access_token?: unknown;
      token_type?: unknown;
      expires_in?: unknown;
      refresh_token?: unknown;
      scope?: unknown;
    };
    if (typeof payload.access_token !== "string" || !payload.access_token) {
      return authNotConfigured("Token endpoint did not return an access_token. No token was invented.");
    }

    return {
      ok: true,
      token_type: typeof payload.token_type === "string" ? payload.token_type : "Bearer",
      access_token: payload.access_token,
      expires_in: typeof payload.expires_in === "number" ? payload.expires_in : null,
      refresh_token: typeof payload.refresh_token === "string" ? payload.refresh_token : null,
      scope: typeof payload.scope === "string" ? payload.scope : null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return authNotConfigured(`Token endpoint is not reachable (${reason}).`);
  }
}

export type RegisterSuccess = {
  ok: true;
  client_id: string;
  client_secret: string | null;
};

export async function registerOAuthClient(
  input: {
    appUrl: string;
    clientName?: string;
    redirectUris?: string[];
    registrationEndpoint?: string;
    urls?: MidkernelAsUrls;
  },
  fetchFn: FetchLike,
): Promise<RegisterSuccess | AuthNotConfigured> {
  const fallback = midkernelAsUrls(input.appUrl);
  const registrationEndpoint =
    input.registrationEndpoint ?? input.urls?.registration_endpoint ?? fallback.registration_endpoint;
  if (isGoogleIdpUrl(registrationEndpoint)) {
    return authNotConfigured("Google is not the Cursor IdP for Midkernel remote MCP.");
  }

  try {
    const response = await fetchFn(registrationEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "midkernel-plugin",
      },
      body: JSON.stringify({
        client_name: input.clientName ?? "Midkernel Cursor MCP",
        redirect_uris: input.redirectUris ?? [...CURSOR_MCP_REDIRECT_URIS],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: MIDKERNEL_AS_SCOPES.join(" "),
      }),
    });

    if (response.status === 404 || response.status === 501) {
      return authNotConfigured(
        `Registration endpoint is not hosted yet (${registrationEndpoint} → HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      return authNotConfigured(`Dynamic client registration failed (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as { client_id?: unknown; client_secret?: unknown };
    if (typeof payload.client_id !== "string" || !payload.client_id) {
      return authNotConfigured("Registration endpoint did not return a client_id. No client was invented.");
    }
    return {
      ok: true,
      client_id: payload.client_id,
      client_secret: typeof payload.client_secret === "string" ? payload.client_secret : null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return authNotConfigured(`Registration endpoint is not reachable (${reason}).`);
  }
}
