/**
 * Midkernel-as-AS client for Cursor remote MCP.
 *
 * Cursor's IdP for this connector is Midkernel — not Google. Google remains
 * the app's own user sign-in. Cursor discovers these URLs via RFC 8414 /
 * RFC 9728 metadata the app will host. If those AS routes are not live yet,
 * helpers return AUTH_NOT_CONFIGURED and never invent a token or run.
 *
 * Agreed app paths (prefix with MIDKERNEL_APP_URL; production includes
 * Next basePath `/app`, e.g. https://midkernel.com/app):
 *   GET  /.well-known/oauth-authorization-server
 *   GET  /.well-known/oauth-protected-resource
 *   GET  /oauth/authorize
 *   POST /oauth/token
 *   POST /oauth/register
 *   POST /oauth/revoke
 *   MCP  /mcp
 *
 * Cursor redirect URIs to register on the app AS:
 *   https://www.cursor.com/agents/mcp/oauth/callback
 *   http://localhost:8787/callback
 */

import { joinAppUrl, type FetchLike } from "./config.js";
import { AUTH_NOT_CONFIGURED_MESSAGE, ErrorCode } from "./errors.js";

export const MIDKERNEL_AS_IDP = "midkernel" as const;

export const MIDKERNEL_AS_PATHS = {
  authorize: "/oauth/authorize",
  token: "/oauth/token",
  register: "/oauth/register",
  revoke: "/oauth/revoke",
  metadata: "/.well-known/oauth-authorization-server",
  protectedResource: "/.well-known/oauth-protected-resource",
  mcp: "/mcp",
} as const;

export const MIDKERNEL_AS_SCOPES = ["scan"] as const;

export const CURSOR_MCP_REDIRECT_URIS = [
  "https://www.cursor.com/agents/mcp/oauth/callback",
  "http://localhost:8787/callback",
] as const;

export type MidkernelAsUrls = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint: string;
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
    revocation_endpoint: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.revoke),
    mcp_endpoint: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.mcp),
    metadata_url: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.metadata),
    protected_resource_url: joinAppUrl(appUrl, MIDKERNEL_AS_PATHS.protectedResource),
  };
}

export function authorizationServerMetadataDocument(appUrl: string): Record<string, unknown> {
  const urls = midkernelAsUrls(appUrl);
  return {
    issuer: urls.issuer,
    authorization_endpoint: urls.authorization_endpoint,
    token_endpoint: urls.token_endpoint,
    registration_endpoint: urls.registration_endpoint,
    revocation_endpoint: urls.revocation_endpoint,
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
    resource: urls.mcp_endpoint,
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
}): AuthorizationRequest | AuthNotConfigured {
  if (!input.clientId.trim()) {
    return authNotConfigured("MIDKERNEL_OAUTH_CLIENT_ID is not set.");
  }
  if (isGoogleIdpUrl(input.appUrl) || isGoogleIdpUrl(input.redirectUri)) {
    return authNotConfigured("Google is not the Cursor IdP for Midkernel remote MCP.");
  }

  const urls = midkernelAsUrls(input.appUrl);
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
  const urls = midkernelAsUrls(appUrl);
  try {
    const response = await fetchFn(urls.metadata_url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "midkernel-plugin" },
    });
    if (response.status === 404 || response.status === 501) {
      return authNotConfigured(
        `Authorization server metadata is not hosted yet (${urls.metadata_url} → HTTP ${response.status}).`,
      );
    }
    if (!response.ok) {
      return authNotConfigured(
        `Authorization server metadata request failed (HTTP ${response.status}).`,
      );
    }
    const metadata = (await response.json()) as Record<string, unknown>;
    const authorize =
      typeof metadata.authorization_endpoint === "string" ? metadata.authorization_endpoint : "";
    const token = typeof metadata.token_endpoint === "string" ? metadata.token_endpoint : "";
    if (isGoogleIdpUrl(authorize) || isGoogleIdpUrl(token)) {
      return authNotConfigured("Google is not the Cursor IdP for Midkernel remote MCP.");
    }
    if (!authorize || !token) {
      return authNotConfigured("Authorization server metadata is missing authorize/token endpoints.");
    }
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
  },
  fetchFn: FetchLike,
): Promise<TokenSuccess | AuthNotConfigured> {
  if (!input.clientId.trim() || !input.code.trim()) {
    return authNotConfigured("OAuth client id and authorization code are required.");
  }

  const urls = midkernelAsUrls(input.appUrl);
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
    const response = await fetchFn(urls.token_endpoint, {
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
        `Token endpoint is not hosted yet (${urls.token_endpoint} → HTTP ${response.status}).`,
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
