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

This plugin is a distribution surface for Midkernel Scan (same pattern as Neon / Vercel: one connector + skills). Not a publish go. Do not invent prices. Do not say a third product name, dollar amounts, knock free Threat Intel, or use a public byline.

## Tools

1. `connect_repo` — select `owner` + `name`, or omit both to list repos on the read-only GitHub App installation. The App API is stubbed in v0; IT owns OAuth and scopes.
2. `list_playbooks` — workflows from the public registry https://github.com/midkernel/playbooks. A shell registry returns an empty list and a note.
3. `start_run` — **profile required**: `low` | `balanced` | `max`. Optional `threat` is a **pin** (threat id or class), not a fourth profile. Credits meter hosted runs — tell the user a real run spends credits. Do not invent prices. Hosted execute is not issued: this tool returns `SCAN_INFRA_UNAVAILABLE` and must not be treated as a successful job.
4. `fetch_run` — status + report. Without a real backend this is unavailable / not found. Do not invent findings.

## How to run a scan (when infra exists)

1. Confirm the Midkernel connector is installed.
2. `connect_repo` for the repository the user named.
3. `list_playbooks` and pick a workflow if the user did not specify one.
4. Ask for a profile if missing. Never coerce `threat` into a profile.
5. Mention that credits meter the run. Then `start_run`.
6. `fetch_run` for status and the report with the complete log.

Until scan infra is issued, stop after the `SCAN_INFRA_UNAVAILABLE` / not-found error. Do not pretend agentflow ran.

## Do not

- Promise Threat Intel tools, class feeds, or originating Threat Intel items
- Treat `--threat` / `threat` as a profile
- Invent run ids, job ids, agentflow execution, or findings
- Bypass credits or invent dollar amounts / pack sizes
- Use a GitHub login other than the user's connected account
