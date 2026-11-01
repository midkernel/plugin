# CI performance and contributor checks

## Existing hosted baseline

The read-only baseline collected on 2026-11-01 at 14:28:43–14:28:49 UTC pinned
this repository to `7934b3e34536fbf9be06df137e3bd28412a00f77`.
The latest-50 inventory request returned 25 runs. The sample selected the latest
three completed PR/main-push runs for CI, ensuring both events were represented,
without filtering by outcome. These three attempts all succeeded. The workflow
text at each sampled head matched the pinned workflow, although that does not
mean their source/dependency inputs were identical. No new hosted run was started
for this change.

| Run (attempt 1) | Event | Created UTC | Workflow wall | Job execution | Install | Typecheck | Tests |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| [40513789655](https://github.com/midkernel/plugin/actions/runs/40513789655) | PR | 2026-10-27 13:38:17 | 19s | 15s | 3s | 2s | 3s |
| [41192016967](https://github.com/midkernel/plugin/actions/runs/41192016967) | PR | 2026-10-31 10:15:36 | 16s | 12s | 3s | 2s | 2s |
| [41291993587](https://github.com/midkernel/plugin/actions/runs/41291993587) | main push | 2026-11-01 09:11:06 | 17s | 14s | 4s | 2s | 3s |

The existing `check` job is named `Typecheck and tests`: checkout, Node 22 with
npm download caching, unconditional `npm ci`, `npm run typecheck`, then `npm test`.
Job-created-to-start scheduling proxies were 4/3/3s; setup totals 6/6/7s; checks
5/4/5s; teardown 0/1/1s; unattributed execution residuals 4/1/1s, respectively.
Wall is workflow creation to final job completion, not push-to-feedback latency.
Timestamps have second precision. Cache hit quality and actual push timestamps
were not captured. Historical evidence is from the supplied baseline; these links
were not freshly fetched during implementation.

## Bounded change

CI now cancels superseded runs only within the same pull request. Non-PR groups
include run ID and attempt, and never cancel, so independent main runs do not
share a pending group. Job/status names, triggers, steps, permissions and main
coverage remain unchanged. No selector, sharding, tool migration, new runner,
dependency, install shortcut or result cache was added. This targets redundant
work; it does not establish a faster individual run for an already small job.

Explicit contributor setup installs a per-worktree pre-push gate. The quick
adapter executes only the existing strict source TypeScript check, preserving
`src/**/*.ts`, all compiler options and `skipLibCheck`. There is no lint or
formatter configuration, and tests are not typechecked by that tsconfig. CI's
full Vitest suite remains separate. See [pre-push coverage and limits](prepush.md).

## Local validation on 2026-11-01

Linux, Git 2.43.0, Python 3.12.3 and Node 22.23.2 were used. The real
`npm run setup:dev` completed in 5.1074s, including the existing locked npm install
and actual hook installation. This setup used the approved package transport;
all runtime/fixture checks were local. No dependency or lockfile upgrade occurred.

Three interleaved local samples used pinned source and installed dependencies for
the existing direct `tsc --noEmit` command, then the new direct adapter:

| Local command | Samples (seconds) |
| --- | --- |
| Pinned source, direct compiler | 3.2158, 3.1093, 2.7518 |
| Working source, quick adapter | 2.9456, 3.0548, 2.6458 |

These are local smoke timings, subject to warm-cache/order effects, not hosted
speedup estimates. A successful local bare-Git push including the installed hook
took 3.5029s. Setup, quick-check and push times measure different operations.

The four shared dispatcher/install/check/test files match the independently
accepted implementation byte for byte. Its 29 synthetic tests passed once and
are reused across both matching repository copies. Actual disposable bare-Git
pushes additionally proved that a committed source type error blocks ref updates,
and a corrected tip passes. Dirty/staged/untracked state, unsupported multi-ref,
tag and non-HEAD pushes, missing Node and missing installed TypeScript all blocked
without changing the bare remote refs. The owned, deliberately uncommitted
checkout was enrolled and its real installed hook rejected its dirty state.

All 62 existing Vitest tests in 10 files passed on baseline and changed copies
with no skips. A diagnostic network sentinel initially caught npm's background
update notifier before network I/O; that caused the harness's final assertion
to fail despite passing tests. Fresh-home reruns with the notifier explicitly
disabled passed 62/62 with zero sentinel attempts (1.9139s baseline, 1.6767s changed).
This is a diagnostic control, not an OS sandbox or a guarantee about future code.
No production API or MCP client was started. The hook itself never invokes npm.

Individual shell syntax checks, Python AST parsing, whitespace checks and
actionlint 1.7.7 passed. Optional actionlint shellcheck/pyflakes integrations were
explicitly disabled. Removing the new concurrency block reproduces the original
workflow byte for byte. HEAD, index, Git config and lockfile are preserved; all
project edits remain unstaged and uncommitted for independent review.

## Hosted after results: pending

No hosted after timing, cancellation behavior, branch-protection result or speedup
is claimed. After publication, compare natural PR and main runs separately using
the same inventory/sample method and timestamps. Retain run/head SHA, attempt,
outcome, job/step timings and runner/cache context. Keep failed, skipped and
cancelled attempts separate. Confirm that only an older run of the same PR is
cancelled, separate PRs and main pushes complete, and the existing check still
reports failures. Report avoided redundant work separately from successful-run
wall time; never count a cancellation or missing check as a passing check.
