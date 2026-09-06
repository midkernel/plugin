import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FetchLike } from "../src/config.js";
import { ErrorCode } from "../src/errors.js";
import {
  authorizationServerMetadataDocument,
  buildAuthorizationRequest,
  CURSOR_MCP_REDIRECT_URIS,
  OAUTH_DCR_OPTIONAL_REDIRECT_SCHEMES,
  discoverAuthorizationServer,
  exchangeAuthorizationCode,
  isGoogleIdpUrl,
  MIDKERNEL_AS_IDP,
  MIDKERNEL_AS_PATHS,
  midkernelAsUrls,
  registerOAuthClient,
  urlsFromMetadata,
} from "../src/oauth.js";

const APP = "https://midkernel.com/app";

function jsonFetch(status: number, body: unknown): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("Midkernel-as-AS client", () => {
  it("documents authorize/token/register paths matching the app AS", () => {
    const urls = midkernelAsUrls(APP);
    expect(urls.authorization_endpoint).toBe("https://midkernel.com/app/oauth/authorize");
    expect(urls.token_endpoint).toBe("https://midkernel.com/app/api/oauth/token");
    expect(urls.registration_endpoint).toBe("https://midkernel.com/app/api/oauth/register");
    expect(urls.revocation_endpoint).toBeNull();
    expect(urls.mcp_endpoint).toBe("https://midkernel.com/app/mcp");
    expect(urls.metadata_url).toBe("https://midkernel.com/app/.well-known/oauth-authorization-server");
    expect(MIDKERNEL_AS_PATHS.authorize).toBe("/oauth/authorize");
    expect(MIDKERNEL_AS_PATHS.token).toBe("/api/oauth/token");
    expect(MIDKERNEL_AS_PATHS.register).toBe("/api/oauth/register");
    expect(MIDKERNEL_AS_PATHS).not.toHaveProperty("revoke");
    expect(MIDKERNEL_AS_IDP).toBe("midkernel");
    expect([...CURSOR_MCP_REDIRECT_URIS]).toEqual([
      "https://www.cursor.com/agents/mcp/oauth/callback",
      "https://www.cursor.com/bot/mcp/oauth/callback",
    ]);
    expect(CURSOR_MCP_REDIRECT_URIS).not.toContain("http://localhost:8787/callback");
    expect([...OAUTH_DCR_OPTIONAL_REDIRECT_SCHEMES]).toEqual([
      "http://localhost",
      "cursor:",
      "vscode:",
    ]);
  });

  it("does not treat Google as the Cursor IdP", () => {
    expect(isGoogleIdpUrl("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);
    expect(isGoogleIdpUrl("https://midkernel.com/app/oauth/authorize")).toBe(false);
    const metadata = authorizationServerMetadataDocument(APP);
    expect(metadata.idp).toBe("midkernel");
    expect(metadata).not.toHaveProperty("revocation_endpoint");
    expect(JSON.stringify(metadata)).not.toMatch(/accounts\.google\.com/);
  });

  it("builds a PKCE authorize URL against Midkernel, not Google", () => {
    const request = buildAuthorizationRequest({
      appUrl: APP,
      clientId: "cursor-midkernel",
      redirectUri: CURSOR_MCP_REDIRECT_URIS[0],
      state: "state-1",
      codeChallenge: "challenge-1",
    });
    expect(request.ok).toBeUndefined();
    if ("error" in request) throw new Error(request.message);
    expect(request.authorization_endpoint).toBe("https://midkernel.com/app/oauth/authorize");
    expect(request.url).toContain("code_challenge_method=S256");
    expect(request.url).not.toContain("accounts.google.com");
  });

  it("refuses a Google authorize host", () => {
    const request = buildAuthorizationRequest({
      appUrl: "https://accounts.google.com",
      clientId: "cursor-midkernel",
      redirectUri: CURSOR_MCP_REDIRECT_URIS[0],
      state: "s",
      codeChallenge: "c",
    });
    expect(request).toMatchObject({ ok: false, error: ErrorCode.AUTH_NOT_CONFIGURED });
  });

  it("returns AUTH_NOT_CONFIGURED when AS metadata is not hosted", async () => {
    const result = await discoverAuthorizationServer(APP, jsonFetch(404, { error: "not found" }));
    expect(result).toMatchObject({ ok: false, error: ErrorCode.AUTH_NOT_CONFIGURED });
    expect(result.ok === false && result.message).toMatch(/not hosted yet/i);
  });

  it("uses authorize/token/register from discovered metadata, not hardcoded fallbacks", async () => {
    const metadata = {
      issuer: APP,
      authorization_endpoint: `${APP}/oauth/authorize`,
      token_endpoint: `${APP}/api/oauth/token`,
      registration_endpoint: `${APP}/api/oauth/register`,
    };
    const result = await discoverAuthorizationServer(APP, jsonFetch(200, metadata));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.urls.token_endpoint).toBe("https://midkernel.com/app/api/oauth/token");
    expect(result.urls.registration_endpoint).toBe("https://midkernel.com/app/api/oauth/register");
    expect(result.urls.authorization_endpoint).toBe("https://midkernel.com/app/oauth/authorize");
    expect(result.urls.revocation_endpoint).toBeNull();

    const overlaid = urlsFromMetadata(midkernelAsUrls(APP), {
      authorization_endpoint: "https://midkernel.com/app/oauth/authorize",
      token_endpoint: "https://example.invalid/discovered/token",
      registration_endpoint: "https://example.invalid/discovered/register",
    });
    expect("error" in overlaid).toBe(false);
    if ("error" in overlaid) throw new Error(overlaid.message);
    expect(overlaid.token_endpoint).toBe("https://example.invalid/discovered/token");
    expect(overlaid.registration_endpoint).toBe("https://example.invalid/discovered/register");
    expect(overlaid.revocation_endpoint).toBeNull();
  });

  it("exchanges against the discovered token endpoint", async () => {
    const seen: string[] = [];
    const fetchFn: FetchLike = async (input) => {
      seen.push(input);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ access_token: "mk_oauth_access", token_type: "Bearer", expires_in: 3600 }),
        text: async () => "",
      };
    };

    const ok = await exchangeAuthorizationCode(
      {
        appUrl: APP,
        clientId: "cursor-midkernel",
        code: "code-1",
        redirectUri: CURSOR_MCP_REDIRECT_URIS[1],
        codeVerifier: "verifier",
        tokenEndpoint: "https://midkernel.com/app/api/oauth/token",
      },
      fetchFn,
    );
    expect(ok).toMatchObject({ ok: true, access_token: "mk_oauth_access" });
    expect(seen).toEqual(["https://midkernel.com/app/api/oauth/token"]);
  });

  it("falls back to /api/oauth/token when discovery urls are not passed", async () => {
    const seen: string[] = [];
    const fetchFn: FetchLike = async (input) => {
      seen.push(input);
      return {
        ok: false,
        status: 404,
        headers: { get: () => null },
        json: async () => ({ error: "not found" }),
        text: async () => "",
      };
    };

    const result = await exchangeAuthorizationCode(
      {
        appUrl: APP,
        clientId: "cursor-midkernel",
        code: "code-1",
        redirectUri: CURSOR_MCP_REDIRECT_URIS[1],
        codeVerifier: "verifier",
      },
      fetchFn,
    );
    expect(result).toMatchObject({ ok: false, error: ErrorCode.AUTH_NOT_CONFIGURED });
    expect(seen).toEqual(["https://midkernel.com/app/api/oauth/token"]);
    expect(seen[0]).not.toBe("https://midkernel.com/app/oauth/token");
  });

  it("maps a real token response and does not invent one on empty bodies", async () => {
    const ok = await exchangeAuthorizationCode(
      {
        appUrl: APP,
        clientId: "cursor-midkernel",
        code: "code-1",
        redirectUri: CURSOR_MCP_REDIRECT_URIS[1],
        codeVerifier: "verifier",
      },
      jsonFetch(200, { access_token: "mk_oauth_access", token_type: "Bearer", expires_in: 3600 }),
    );
    expect(ok).toMatchObject({ ok: true, access_token: "mk_oauth_access" });

    const empty = await exchangeAuthorizationCode(
      {
        appUrl: APP,
        clientId: "cursor-midkernel",
        code: "code-1",
        redirectUri: CURSOR_MCP_REDIRECT_URIS[1],
        codeVerifier: "verifier",
      },
      jsonFetch(200, { token_type: "Bearer" }),
    );
    expect(empty).toMatchObject({ ok: false, error: ErrorCode.AUTH_NOT_CONFIGURED });
  });

  it("registers against /api/oauth/register and does not invent a client id", async () => {
    const seen: string[] = [];
    const fetchFn: FetchLike = async (input) => {
      seen.push(input);
      return {
        ok: true,
        status: 201,
        headers: { get: () => null },
        json: async () => ({ client_id: "cid_1" }),
        text: async () => "",
      };
    };
    const result = await registerOAuthClient({ appUrl: APP }, fetchFn);
    expect(result).toMatchObject({ ok: true, client_id: "cid_1" });
    expect(seen).toEqual(["https://midkernel.com/app/api/oauth/register"]);

    const missing = await registerOAuthClient({ appUrl: APP }, jsonFetch(200, {}));
    expect(missing).toMatchObject({ ok: false, error: ErrorCode.AUTH_NOT_CONFIGURED });
  });

  it("pins agreed paths in oauth-metadata.json and mcp.json", () => {
    const metadata = JSON.parse(readFileSync("src/oauth-metadata.json", "utf8")) as {
      idp: string;
      not_idp: string;
      paths: Record<string, string>;
      revocation_endpoint: null;
      cursor_redirect_uris: string[];
    };
    const mcp = JSON.parse(readFileSync("mcp.json", "utf8")) as {
      mcpServers: { "midkernel-remote": { url: string; auth: { scopes: string[] } } };
    };
    expect(metadata.idp).toBe("midkernel");
    expect(metadata.not_idp).toBe("google");
    expect(metadata.paths.authorization_endpoint).toBe("/oauth/authorize");
    expect(metadata.paths.token_endpoint).toBe("/api/oauth/token");
    expect(metadata.paths.registration_endpoint).toBe("/api/oauth/register");
    expect(metadata.revocation_endpoint).toBeNull();
    expect(metadata.cursor_redirect_uris).toEqual([
      "https://www.cursor.com/agents/mcp/oauth/callback",
      "https://www.cursor.com/bot/mcp/oauth/callback",
    ]);
    expect(metadata.cursor_redirect_uris).not.toContain("http://localhost:8787/callback");
    expect(mcp.mcpServers["midkernel-remote"].url).toBe("${MIDKERNEL_APP_URL}/mcp");
    expect(mcp.mcpServers["midkernel-remote"].auth.scopes).toEqual(["scan"]);
  });
});
