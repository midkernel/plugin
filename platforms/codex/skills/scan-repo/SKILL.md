---
name: scan-repo
description: Use this when the user wants to scan a repository for security issues with Midkernel Scan.
---

# Midkernel

Scan a GitHub repository from your agent. Midkernel Scan runs an open workflow in an isolated sandbox and returns a report with the complete log. Credits meter the run.

Use this when the user wants to scan a repository for security issues with Midkernel Scan.

## Install confirm

Add the Midkernel connector? It lets this agent run Midkernel Scan on a GitHub repository you choose.

## After install

Connect your Midkernel account, then pick a repository. The GitHub app is read-only. Then choose a workflow and a profile — `low`, `balanced`, or `max`. Credits are shown before a run starts. Optional `--threat <class>` pins an existing profile to a threat class; it is not a fourth profile.

## Micro

Read-only GitHub app · credits per run · no write access

This plugin is a distribution surface for Midkernel Scan (same pattern as Neon / Vercel: one connector + skills). Hosted Production Scan is live (app HTTP → native ECS agentflow → `report.md`). Do not invent prices. Do not say a third product name, dollar amounts, knock free Threat Intel, or use a public byline.

## Tools

1. `connect_repo` — select `owner` + `name`, or omit both to list repos on the read-only GitHub App installation. When Midkernel session tokens are present, list via the app or the GitHub installation API. Do not invent repos.
2. `list_playbooks` — workflows from the public registry https://github.com/midkernel/playbooks. Prefer `security-review` as the default Midkernel Scan playbook; it runs `/security-review` one-shot. Other published playbooks are allowed when the user asks. A shell registry returns an empty list and a note.
3. `start_run` — **profile required**: `low` | `balanced` | `max`. When the user does not name a workflow, use `security-review`. Optional `threat` is a **pin** (threat id or class), not a fourth profile. Credits meter hosted runs — tell the user a real run spends credits. Do not invent prices. When `MIDKERNEL_APP_URL` and Midkernel auth are configured, this calls the app Scan API. Otherwise it returns `SCAN_INFRA_UNAVAILABLE` or `AUTH_NOT_CONFIGURED`. Do not invent a successful job.
4. `fetch_run` — status + report from the app. Report exists only after a real model pass. Do not invent findings.

## How to run a scan

1. Confirm the Midkernel connector is installed. Cursor remote MCP uses **Midkernel** as the authorization server, not Google.
2. `connect_repo` for the repository the user named.
3. `list_playbooks` and pick a workflow if the user did not specify one. Prefer `security-review` as the default Midkernel Scan playbook; it runs `/security-review` one-shot. Use another published playbook only when the user asks.
4. Ask for a profile if missing. Never coerce `threat` into a profile.
5. Mention that credits meter the run. Then `start_run`.
6. `fetch_run` for status and the report with the complete log.

If the tool returns `AUTH_NOT_CONFIGURED` or `SCAN_INFRA_UNAVAILABLE`, stop. Production Scan is live (app HTTP → native ECS agentflow → `report.md`); local without auth still fails closed. Do not invent a successful run.

## Do not

- Promise Threat Intel tools, class feeds, or originating Threat Intel items
- Treat `--threat` / `threat` as a profile
- Invent run ids, job ids, agentflow execution, or findings
- Bypass credits or invent dollar amounts / pack sizes
- Use a GitHub login other than the user's connected account
- Use Google as the Cursor IdP for this connector
