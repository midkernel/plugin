import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FetchLike } from "../src/config.js";
import { ErrorCode } from "../src/errors.js";
import {
  authorizationServerMetadataDocument,
  buildAuthorizationRequest,
  CURSOR_MCP_REDIRECT_URIS,
  discoverAuthorizationServer,
  exchangeAuthorizationCode,
  isGoogleIdpUrl,
  MIDKERNEL_AS_IDP,
  MIDKERNEL_AS_PATHS,
  midkernelAsUrls,
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
  it("documents authorize/token/MCP paths under the app URL", () => {
    const urls = midkernelAsUrls(APP);
    expect(urls.authorization_endpoint).toBe("https://midkernel.com/app/oauth/authorize");
    expect(urls.token_endpoint).toBe("https://midkernel.com/app/oauth/token");
    expect(urls.mcp_endpoint).toBe("https://midkernel.com/app/mcp");
    expect(urls.metadata_url).toBe("https://midkernel.com/app/.well-known/oauth-authorization-server");
    expect(MIDKERNEL_AS_PATHS.authorize).toBe("/oauth/authorize");
    expect(MIDKERNEL_AS_IDP).toBe("midkernel");
    expect(CURSOR_MCP_REDIRECT_URIS).toContain("https://www.cursor.com/agents/mcp/oauth/callback");
  });

  it("does not treat Google as the Cursor IdP", () => {
    expect(isGoogleIdpUrl("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);
    expect(isGoogleIdpUrl("https://midkernel.com/app/oauth/authorize")).toBe(false);
    const metadata = authorizationServerMetadataDocument(APP);
    expect(metadata.idp).toBe("midkernel");
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

  it("returns AUTH_NOT_CONFIGURED when the token route is not hosted", async () => {
    const result = await exchangeAuthorizationCode(
      {
        appUrl: APP,
        clientId: "cursor-midkernel",
        code: "code-1",
        redirectUri: CURSOR_MCP_REDIRECT_URIS[1],
        codeVerifier: "verifier",
      },
      jsonFetch(404, { error: "not found" }),
    );
    expect(result).toMatchObject({ ok: false, error: ErrorCode.AUTH_NOT_CONFIGURED });
    expect(result.ok === false && result.message).not.toMatch(/access_token":"/);
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

  it("pins agreed paths in oauth-metadata.json and mcp.json", () => {
    const metadata = JSON.parse(readFileSync("src/oauth-metadata.json", "utf8")) as {
      idp: string;
      not_idp: string;
      paths: Record<string, string>;
    };
    const mcp = JSON.parse(readFileSync("mcp.json", "utf8")) as {
      mcpServers: { "midkernel-remote": { url: string; auth: { scopes: string[] } } };
    };
    expect(metadata.idp).toBe("midkernel");
    expect(metadata.not_idp).toBe("google");
    expect(metadata.paths.authorization_endpoint).toBe("/oauth/authorize");
    expect(metadata.paths.token_endpoint).toBe("/oauth/token");
    expect(mcp.mcpServers["midkernel-remote"].url).toBe("${MIDKERNEL_APP_URL}/mcp");
    expect(mcp.mcpServers["midkernel-remote"].auth.scopes).toEqual(["scan"]);
  });
});
