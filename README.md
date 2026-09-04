# Midkernel plugin

Cursor / Grok Bot **plugin** for Midkernel Scan. Catalog name: **Midkernel**. One OAuth MCP connector + skills (same pattern as Neon / Vercel). Not a third product. Not a new bot teammate.

v0 defines the MCP tools and the scan skill. **Hosted execute is not issued.** `start_run` returns `SCAN_INFRA_UNAVAILABLE`. This package does not fake a successful run, job ids, or agentflow.

Tracker: [midkernel/website#17](https://github.com/midkernel/website/issues/17). This repo does not close that issue until start-run is a real hosted execute.

## Tools

| Tool | What |
| --- | --- |
| `connect_repo` | Select `owner` + `name`, or list installation repos. Read-only GitHub App — **stubbed**. |
| `list_playbooks` | Workflows from public [`midkernel/playbooks`](https://github.com/midkernel/playbooks). Shell registry → empty list + note. |
| `start_run` | **profile required:** `low` \| `balanced` \| `max`. `threat` is an optional **pin**, not a fourth profile. Always `SCAN_INFRA_UNAVAILABLE` until scan infra exists. Credits meter hosted runs (no Stripe here). |
| `fetch_run` | Status + report. Unavailable / not found. No invented findings. |

Out of v0: Threat Intel tools, Stripe, catalog icon, live GitHub App OAuth.

## Skill

`skills/scan-repo/SKILL.md` — use when the user wants to scan a repository for security issues. Points at the tools above. Does not promise Threat Intel.

## Package layout

```
.cursor-plugin/plugin.json   Cursor plugin manifest (catalog name: midkernel)
mcp.json                     stdio MCP server (auto-discovered)
skills/scan-repo/SKILL.md    scan skill
src/                         TypeScript MCP server (@modelcontextprotocol/sdk)
tests/                       profiles, threat pin, no fake start_run success
```

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

Plugin variables in `.cursor-plugin/plugin.json` are placeholders. The server boots without real secrets.

```bash
npm run typecheck
npm test
```

## Env placeholders

See `.env.example`. Nothing here is a live credential.

| Variable | Owner | Status |
| --- | --- | --- |
| `GITHUB_APP_*` | IT | Stub. OAuth + read-only App scopes later. |
| `SCAN_API_URL` / `SCAN_API_TOKEN` | Engineering | Unissued. Do not point at a fake backend. |
| Stripe / prices | — | Credits still meter. **Do not implement Stripe in this repo.** |

## Blocked on scan infra

Engineering must not treat this PR as a working hosted Scan. Until start-run is a real execute:

- `start_run` → `SCAN_INFRA_UNAVAILABLE`
- `fetch_run` → unavailable / `RUN_NOT_FOUND`
- no invented findings, job ids, or agentflow

`Fixes` / `Closes` on website#17 wait for that backend.

## Ownership

| Surface | Owner |
| --- | --- |
| MCP server, plugin package, catalog listing mechanics | Engineering |
| OAuth app, GitHub App scopes, Workspace identity (`james@midkernel.com`) | IT |
| Catalog name / blurb / install copy (company/anon; no public byline) | Marketing |
| Plugin icon (outlined mark, phosphor once) | Design |
| Tracker + funnel | CoS |

Our GitHub login on this repo is `mdashjames` only. Do not put that name on catalog copy.

## Credits

Credits meter a hosted Scan. Tools mention that spend. This package does not charge, invent pack sizes, or talk to Stripe.
