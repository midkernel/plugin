# Contributor pre-push checks

Run `npm run setup:dev` from this checkout with POSIX sh, Git >=2.31, Python 3,
Node >=22 (CI uses Node 22), and npm available. Setup checks prerequisites, runs
the existing locked `npm ci` with its normal install lifecycle, then executes
`python3 -I scripts/prepush/install.py`. Ordinary `npm ci`, including CI install,
does not install hooks. A failed setup is not successful enrollment.

The installer writes Git's default shared `hooks/pre-push` dispatcher (0700) and
this worktree's `$GIT_DIR/midkernel-prepush-v1` marker (0600), without changing
Git configuration or identity. Linked siblings must enroll separately. Repeat
setup accepts identical executable dispatcher bytes. Setup may precede a commit,
but the resulting dirty checkout cannot pass the gate.

Any effective `core.hooksPath`, different or symlink hook, symlink hook directory,
invalid marker, or matching hook without execute permission blocks setup. The
installer preserves these files/configuration; arrange integration with their
owner. It does not chain, migrate or overwrite custom hooks. A manually composed
hook must deliver the same buffered stdin to each checker and preserve failures.
To unenroll, remove only this worktree's marker under the directory printed by
`git rev-parse --absolute-git-dir`; leave the shared dispatcher for siblings.
An enrolled branch missing support files fails closed. Review upgrades explicitly:
different installed dispatcher bytes are never replaced automatically.

## Exact quick coverage

From the repository root, `./scripts/prepush/quick-check.sh` directly executes
`node node_modules/typescript/bin/tsc --noEmit`. It requires Node >=22 and the
installed compiler. It preserves every option and root in `tsconfig.json`:
`src/**/*.ts`, strict checking and `noUncheckedIndexedAccess`, with `skipLibCheck`
still enabled. It does not typecheck test files, build output, run Vitest, start
the MCP server, or call application/registry APIs. There is no configured lint
or formatter tool here; this gate does not claim either coverage.

No npm pre/post lifecycle, npx, install or download runs inside the quick adapter.
Missing tools/dependencies and nonzero compiler exits block pushes. After changing
dependencies, rerun setup; the gate does not prove installed dependencies still
match the lockfile. CI retains its locked install, separate typecheck step and
complete Vitest step with existing isolation.

## Supported pushes and limits

- One branch update whose object is current HEAD: an ordinary local branch,
  literal `HEAD`, or its full object ID, including detached HEAD. A force update
  runs the same checks; this does not authorize overwriting remote history.
- No updated refs, or a single branch/tag deletion, needs no content check.
- Tag creation/update, multiple refs, non-HEAD tips, other namespaces and source
  revision expressions are rejected. Prepare the intended tip in its own enrolled
  worktree; tags need the reviewed release procedure.
- Staged, unstaged and nonignored untracked changes block pushes. Submodules,
  assume-unchanged and skip-worktree/sparse entries are unsupported. HEAD and
  cleanliness are checked before and after validation. Nothing is automatically
  stashed, reset, committed or checked out.

The checker supplies a small environment, temporary home/cache, and inherited
PATH. Credential variables, Node options, Python paths and Git repository-selection
variables are not forwarded to the adapter. This is environment hygiene, not an
OS network sandbox. Local source, tools and dependencies remain trusted inputs.
Ignored inputs (including node_modules), Git's ordinary stat comparisons and
concurrent-edit races prevent a hermetic guarantee. Only the current tip is
checked, not every historical commit being pushed; there is no validator timeout.
`git push --no-verify`, changed hooks/configuration, removed enrollment and edited
checkers can bypass the gate. CI remains authoritative.

Run `python3 -I scripts/prepush/test_hook.py` for the shared install/protocol tests.
They use disposable repositories and local bare remotes, with Midkernel fixture
authorship and no network. Set `MIDKERNEL_PREPUSH_TEST_DIR` to an existing private
directory to choose their temporary location. They are not run inside each push.
See [CI performance](ci-performance.md) for validation and timing limits.
