# Midkernel for ChatGPT

Portable Agent Plugins package for the hosted Midkernel Scan MCP. ChatGPT and Codex share one public plugin directory; this folder is that package. It does not ship a second Scan API.

| | |
| --- | --- |
| MCP | `https://www.midkernel.com/security/app/mcp` (Streamable HTTP) |
| Issuer | `https://www.midkernel.com/security/app` |
| PKCE | S256 |
| Scope | `scan` |
| Tools | `connect_repo`, `list_playbooks`, `start_run`, `fetch_run` |
| Docs | https://www.midkernel.com/security/docs/mcp |

Manifest shape follows [Package your plugin](https://developers.openai.com/plugins/build/plugins): root `plugin.json` (`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`) and root `mcp.json` (`type: streamable-http`). OAuth is discovered from the MCP server. There is no `.app.json` and no pre-registered `plugin_asdk_app` id in this spike.

`interface.shortDescription` is `Scan a GitHub repository` (25 characters). OpenAI final directory submission limits that field to 30 characters. `description` and `interface.longDescription` keep the full signed catalog blurb. The manifests link to the published [privacy policy](https://www.midkernel.com/legal/privacy) and [terms of service](https://www.midkernel.com/legal/terms), verified on 2026-10-05. Directory submission remains with Marketing. This spike does not submit the listing.

## Install (developer mode)

From [Package your plugin](https://developers.openai.com/plugins/build/plugins):

1. Open ChatGPT → Settings → Security and login → turn on Developer mode.
2. Open ChatGPT Plugins → plus.
3. Enter the MCP server URL `https://www.midkernel.com/security/app/mcp`.
4. Complete OAuth when ChatGPT asks. The authorization server is Midkernel (PKCE S256, scope `scan`).

Repo marketplace for a local install of this folder: `.agents/plugins/marketplace.json` at the repository root. Restart the ChatGPT desktop app, open the Plugins directory, choose the Midkernel marketplace, and install **midkernel**.

## OAuth redirect for IT

See [OAUTH-REDIRECTS.md](../OAUTH-REDIRECTS.md). Exact stable URI from the auth docs:

`https://chatgpt.com/connector_platform_oauth_redirect`

[IT’s 2026-10-19 checks](https://github.com/midkernel/strategy/issues/53#issuecomment-6277402939) report `authorization_response_iss_parameter_supported: true` for the migrated issuer. The exact host-selected callback, production allowlist reconciliation, and an actual ChatGPT OAuth flow remain pending on app#260 and strategy#53. If a host supplies the fallback `https://chatgpt.com/connector/oauth/{callback_id}` form, copy its finished URI; do not invent `{callback_id}`.

IT reports that unauthenticated requests to the hosted MCP return HTTP 401 with `WWW-Authenticate: Bearer realm="midkernel", resource_metadata="https://www.midkernel.com/security/app/.well-known/oauth-protected-resource"`.
