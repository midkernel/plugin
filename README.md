# Midkernel plugin

Cursor / Grok Bot **plugin** for Midkernel Scan. Catalog name: **Midkernel**. One OAuth MCP connector + skills (same pattern as Neon / Vercel). Not a third product. Not a new bot teammate.

v0 talks to **midkernel/app Scan APIs** when `MIDKERNEL_APP_URL` and auth are set (`POST /api/scans/start`, `GET /api/runs/:id`, `GET /api/repos`, `GET /api/playbooks`). That is the real one-shot `security-review` path. **AWS ECS agentflow is still unissued** and is not faked. Without URL/auth this package returns `SCAN_INFRA_UNAVAILABLE` / `AUTH_NOT_CONFIGURED` — it does not invent a successful run, job ids, or findings.

Tracker: [midkernel/website#17](https://github.com/midkernel/website/issues/17). Coordinate with [midkernel/app#13](https://github.com/midkernel/app/pull/13) (run routes). Midkernel-as-AS routes may still be unmerged — the client is wired to the agreed paths and fails closed.

## Tools

| Tool | What |
| --- | --- |
| `connect_repo` | Select `owner` + `name`, or list installation repos. Read-only GitHub App. Uses app `GET /api/repos` or GitHub installation listing when session tokens exist. |
| `list_playbooks` | App `GET /api/playbooks` when auth is configured; else public [`midkernel/playbooks`](https://github.com/midkernel/playbooks). Default playbook is `security-review` from the public registry. Shell registry → empty list + note. |
| `start_run` | **profile required:** `low` \| `balanced` \| `max`. `threat` is an optional **pin**, not a fourth profile. Calls the app when URL/auth are configured. Credits meter hosted runs (no Stripe here). |
| `fetch_run` | Status + report from the app. Report only after a real model pass. No invented findings. |

Out of this package: Threat Intel tools, Stripe, AWS ECS agentflow, Google-as-Cursor-IdP.

## Real path vs AWS-still-missing

| Path | Status |
| --- | --- |
| **v0 one-shot** (`security-review` via midkernel/app HTTP) | Real when `MIDKERNEL_APP_URL` + Midkernel OAuth or `MIDKERNEL_API_TOKEN` are set. Mapped from the app. Tests mock HTTP. |
| **AWS ECS agentflow** | Still missing (infra draft). This plugin does not invent agentflow success. |

## Catalog (signed copy)

Name: **Midkernel**

Blurb: Scan a GitHub repository from your agent. Midkernel Scan runs an open workflow in an isolated sandbox and returns a report with the complete log. Credits meter the run.

Skill: Use this when the user wants to scan a repository for security issues with Midkernel Scan.

Install confirm: Add the Midkernel connector? It lets this agent run Midkernel Scan on a GitHub repository you choose.

After install: Connect your Midkernel account, then pick a repository. The GitHub app is read-only. Then choose a workflow and a profile — `low`, `balanced`, or `max`. Credits are shown before a run starts. Optional `--threat <class>` pins an existing profile to a threat class; it is not a fourth profile.

Micro: Read-only GitHub app · credits per run · no write access

Do not invent prices. Do not knock free Threat Intel. Do not use a third product name or a public byline.

## Skill

`skills/scan-repo/SKILL.md` — use when the user wants to scan a repository for security issues with Midkernel Scan. Points at the tools above. Does not promise Threat Intel.

## Package layout

```
.cursor-plugin/plugin.json   Cursor plugin manifest (catalog name: midkernel)
mcp.json                     stdio MCP + remote Midkernel-as-AS entry
src/oauth-metadata.json      agreed authorize/token/MCP paths
assets/icon.svg              catalog mark (source)
assets/icon.png              catalog tile (512, Void + phosphor)
skills/scan-repo/SKILL.md    scan skill
src/                         TypeScript MCP server (@modelcontextprotocol/sdk)
tests/                       mocked app HTTP; no invented start_run success
```

Catalog icon is Design’s outlined square on Void `#0B0D10`, Paper outline, phosphor `#B7FF5C` once. Manifest `logo` points at `assets/icon.png`. Source: `midkernel/design/plugin`.

## Run locally

Requires Node 22+.

```bash
cp .env.example .env
npm install
npm start
```

`npm start` is an MCP stdio server. It waits on stdin. Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) or point Cursor at this repo:

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```

Local Cursor config (`~/.cursor/mcp.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "midkernel": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/plugin"
    }
  }
}
```

Plugin variables in `.cursor-plugin/plugin.json` are placeholders. The server boots without real secrets. Placeholder `PLACEHOLDER_*` values are treated as unset.

```bash
npm run typecheck
npm test
```

## Env

See `.env.example`. Nothing here is a live credential.

| Variable | Owner | Status |
| --- | --- | --- |
| `MIDKERNEL_APP_URL` | Engineering | App origin including `/app` in production. Alias: `SCAN_API_URL`. |
| `MIDKERNEL_API_TOKEN` | Engineering / IT | Stdio bearer until Midkernel OAuth. Alias: `SCAN_API_TOKEN`. |
| `MIDKERNEL_OAUTH_CLIENT_ID` | IT | Static Cursor remote MCP client. Midkernel AS, not Google. |
| `GITHUB_INSTALLATION_TOKEN` | Session / app | Optional read-only installation listing fallback. |
| `GITHUB_APP_*` | IT | App credentials stay on midkernel/app. |
| Stripe / prices | — | Credits still meter. **Do not implement Stripe in this repo.** |

## OAuth / remote MCP (Midkernel-as-AS)

Cursor remote MCP authenticates against **Midkernel**, not Google. Google may still sign users into the app UI.

Agreed URLs the app will host (prefix `MIDKERNEL_APP_URL`):

| | Path |
| --- | --- |
| Metadata | `/.well-known/oauth-authorization-server` |
| Protected resource | `/.well-known/oauth-protected-resource` |
| Authorize | `/oauth/authorize` |
| Token | `/api/oauth/token` |
| Register | `/api/oauth/register` |
| Revoke | not hosted (optional; do not require) |
| Remote MCP | `/mcp` |

Cursor redirect URIs to register on the app AS:

- `https://www.cursor.com/agents/mcp/oauth/callback`
- `http://localhost:8787/callback`

`mcp.json` includes `midkernel-remote` with `auth.CLIENT_ID` + scope `scan`. Discovery uses authorize/token/register from AS metadata when present (hardcoded paths are fallbacks only). If AS routes are not live, helpers return **`AUTH_NOT_CONFIGURED`** and never invent a token or run.

## Ownership

| Surface | Owner |
| --- | --- |
| MCP server, plugin package, catalog listing mechanics | Engineering |
| OAuth app (Midkernel AS), GitHub App scopes, Workspace identity (`james@midkernel.com`) | IT |
| Catalog name / blurb / install copy (company/anon; no public byline) | Marketing |
| Plugin icon (outlined mark, phosphor once) | Design — included at `assets/icon.svg` / `assets/icon.png` |
| Tracker + funnel | CoS |

Our GitHub login on this repo is `mdashjames` only. Do not put that name on catalog copy.

## Credits

Credits meter a hosted Scan. Tools mention that spend. This package does not charge, invent pack sizes, or talk to Stripe.
