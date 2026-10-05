# OAuth redirect URIs for IT (app#260)

Verified 2026-10-01 from the platform docs linked below. Hosted Scan MCP stays `https://www.midkernel.com/app/mcp`. Issuer stays `https://www.midkernel.com/app`. PKCE is S256. Scope is `scan`. Public docs: https://midkernel.com/docs/mcp (that URL redirects to https://www.midkernel.com/docs/mcp).

This package does not change Production allowlist env. IT owns that update on [midkernel/app#260](https://github.com/midkernel/app/issues/260).

## Exact strings to add

| Redirect URI | Hosts | When the host sends it |
| --- | --- | --- |
| `https://chatgpt.com/connector_platform_oauth_redirect` | ChatGPT and Codex plugin hosts | The authorization server advertises `authorization_response_iss_parameter_supported: true`, the protected-resource `authorization_servers` entry equals `issuer` exactly, and every authorization response (including errors) returns that `iss`. Servers published before callback-id redirects also keep this URI. Source: [Authentication – Plugins](https://developers.openai.com/plugins/build/auth). |
| `https://claude.ai/api/mcp/auth_callback` | claude.ai web, Claude Desktop, Claude mobile, Cowork | Every hosted Claude connection. Register this string exactly. Source: [Authentication for connectors](https://claude.com/docs/connectors/building/authentication). |

## Templates — do not invent a concrete suffix

Official docs publish these patterns. They do not publish a finished URI for the Midkernel MCP URL. Leave them off the allowlist until the host shows the exact string.

| Pattern | Host | How to get the exact string |
| --- | --- | --- |
| `https://chatgpt.com/connector/oauth/{callback_id}` | ChatGPT | Used when issuer identification is absent. Copy the production redirect from the MCP server management page. Prefix verified: `https://chatgpt.com/connector/oauth/`. |
| `http://127.0.0.1/callback` | Codex CLI | Displayed and stored when issuer identification is advertised. Codex inserts the listener port at authorization time. Match any port on host `127.0.0.1` and path `/callback` (RFC 8252 §7.3). Codex docs say this port substitution does not apply to hostname `localhost`. Source: [Codex MCP](https://developers.openai.com/codex/mcp). |
| `http://127.0.0.1/callback/{callback_id}` | Codex CLI | Used when issuer identification is absent. Codex derives `{callback_id}` from the MCP server URL. Copy the callback printed by `codex mcp add`. |
| `http://localhost/callback` | Claude Code | Declared in the Claude Code Client ID Metadata Document. Match with the port ignored. |
| `http://127.0.0.1/callback` | Claude Code | Declared beside the localhost form. Match with the port ignored. |

Claude’s authentication page gives `http://localhost:3118/callback` as an ephemeral example. That port is an illustration. It is not an allowlist entry.

Loopback `localhost` for Claude Code ephemeral ports is already allowed in the app. Confirm the same port-agnostic match also covers host `127.0.0.1` and path `/callback`, because Claude Code’s metadata document and Codex CLI’s default callback both name `127.0.0.1`.

## Client ID URLs — leave these off the redirect allowlist

| URL | Role |
| --- | --- |
| `https://chatgpt.com/oauth/client.json` | ChatGPT CIMD `client_id` when issuer identification is met |
| `https://chatgpt.com/oauth/{callback_id}/client.json` | ChatGPT CIMD `client_id` otherwise |
| `https://chatgpt.com/oauth/codex/client.json` | Codex CLI stable CIMD `client_id` when issuer identification is met |
| `https://chatgpt.com/oauth/codex/{callback_id}/client.json` | Codex CLI CIMD `client_id` otherwise |

## Production metadata verified on 2026-10-05

After [app#264](https://github.com/midkernel/app/pull/264) deployed, read-only checks confirmed:

- Authorization-server issuer is `https://www.midkernel.com/app`.
- `authorization_response_iss_parameter_supported` and `client_id_metadata_document_supported` are both `true`.
- PKCE S256, scope `scan`, `token_endpoint_auth_methods_supported: ["none"]`, and the registration endpoint remain advertised.
- Protected-resource `resource` is `https://www.midkernel.com/app/mcp`, and `authorization_servers` contains the issuer above.
- An unauthenticated GET to the hosted MCP returns HTTP 401 with `WWW-Authenticate: Bearer realm="midkernel", resource_metadata="https://www.midkernel.com/app/.well-known/oauth-protected-resource"`.

The deployed backend now advertises the metadata needed for issuer identification and CIMD. These discovery checks do not establish that the Production redirect allowlist has been updated or that a platform login succeeds. Those two checks remain on [app#260](https://github.com/midkernel/app/issues/260) before this draft package is marked ready.

Cursor and Grok Bot redirects already on the allowlist stay as they are:

- `https://www.cursor.com/agents/mcp/oauth/callback`
- `https://www.cursor.com/bot/mcp/oauth/callback`
