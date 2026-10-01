# Midkernel for Codex

Codex packaging for the hosted Midkernel Scan MCP. Same server as ChatGPT and Claude. Tools stay `connect_repo`, `list_playbooks`, `start_run`, `fetch_run`. Docs: https://midkernel.com/docs/mcp.

| File | Role |
| --- | --- |
| `plugin.json` + `mcp.json` | Portable Agent Plugins package. `mcp.json` uses `type: streamable-http` per [Package your plugin](https://developers.openai.com/plugins/build/plugins). |
| `.codex-plugin/plugin.json` + `.mcp.json` | Compatibility layout. `.mcp.json` uses `type: http` per [Codex MCP](https://developers.openai.com/codex/mcp). `mcpServers` is `./.mcp.json`. |
| `config.example.toml` | Direct Streamable HTTP server for Codex CLI, the IDE extension, and the ChatGPT desktop app. |

The public plugin directory is shared with ChatGPT. Submit that listing from `platforms/chatgpt` (package name `midkernel`) once. This folder’s package name is `midkernel-codex` so a repo marketplace can offer the Codex CLI layout beside that package. Display name on both is **Midkernel**.

## Install the hosted server in Codex CLI

```bash
codex mcp add midkernel --url https://www.midkernel.com/app/mcp
codex mcp login midkernel
```

`codex mcp add` prints the OAuth callback to register. When the authorization server advertises issuer identification, Codex shows `http://127.0.0.1/callback` and inserts the listener port during login. When it does not, Codex appends a callback id. Production metadata on 2026-10-01 did not advertise issuer identification, so expect the callback-id form until that metadata changes. Register the printed string. See [OAUTH-REDIRECTS.md](../OAUTH-REDIRECTS.md).

Equivalent `config.toml` table: `config.example.toml`.

## Install the plugin folder

Repo marketplace: `.agents/plugins/marketplace.json`. It lists `midkernel` (`platforms/chatgpt`) and `midkernel-codex` (this folder). In the ChatGPT desktop app, select Codex or ChatGPT Work, open Plugins, choose the Midkernel marketplace, and install one package. Both point at `https://www.midkernel.com/app/mcp`.

Plugin OAuth fields `clientId` and `callbackUrl` are omitted. Codex then uses its documented default callback and CIMD or dynamic client registration. A configured client id would skip registration; this spike does not invent one.
