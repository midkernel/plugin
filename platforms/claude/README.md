# Midkernel for Claude

Claude Code plugin and remote-MCP install for hosted Midkernel Scan. Claude.ai, Claude Desktop, and Cowork use the same MCP URL as a custom connector. Directory submission is a later Marketing step. Docs: https://www.midkernel.com/security/docs/mcp.

| | |
| --- | --- |
| MCP | `https://www.midkernel.com/security/app/mcp` |
| Transport | `http` in `.mcp.json` ([Claude Code MCP](https://code.claude.com/docs/en/mcp)) |
| Scope | `scan` (`oauth.scopes`, one space-separated string) |
| Tools | `connect_repo`, `list_playbooks`, `start_run`, `fetch_run` |
| Plugin manifest | `.claude-plugin/plugin.json` |
| Marketplace | repository-root `.claude-plugin/marketplace.json` |

## Claude Code

Add the server directly:

```bash
claude mcp add --transport http midkernel https://www.midkernel.com/security/app/mcp
```

Then run `/mcp` or `claude mcp login midkernel` and sign in. Claude Code uses an ephemeral loopback port. The app already allows localhost loopback for those ports. Leave `--callback-port` unset so the port can change. Claude Code’s Client ID Metadata Document declares `http://localhost/callback` and `http://127.0.0.1/callback` with the port ignored. Details: [OAUTH-REDIRECTS.md](../OAUTH-REDIRECTS.md).

Install this folder as a plugin:

```text
/plugin marketplace add midkernel/plugin
/plugin install midkernel@midkernel
```

From a local checkout, `marketplace add` the repository root (the directory that contains `.claude-plugin/marketplace.json`).

## claude.ai, Desktop, and Cowork

Hosted surfaces redirect to `https://claude.ai/api/mcp/auth_callback`. Add that exact URI on the Midkernel authorization server (app#260).

Custom connector (prefilled dialog from [Directory connectors vs custom connectors](https://claude.com/docs/connectors/building/directory-vs-custom)):

https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Midkernel&connectorUrl=https%3A%2F%2Fwww.midkernel.com%2Fsecurity%2Fapp%2Fmcp

Organization settings path: Organization settings → Connectors → Add → Custom. MCP server URL: `https://www.midkernel.com/security/app/mcp`.

[IT’s 2026-10-19 checks](https://github.com/midkernel/strategy/issues/53#issuecomment-6277402939) report HTTP 401 and a `WWW-Authenticate` header pointing at `https://www.midkernel.com/security/app/.well-known/oauth-protected-resource`. The same report sets protected-resource `resource` to the MCP URL `https://www.midkernel.com/security/app/mcp`. Production allowlist reconciliation and an actual Claude OAuth flow remain pending on app#260 and strategy#53.
