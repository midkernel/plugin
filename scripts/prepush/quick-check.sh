#!/bin/sh
# Run from the repository root. No npm lifecycle, install or application startup.
set -eu
command -v node >/dev/null 2>&1 || {
    echo 'pre-push: Node >=22 is required; see docs/prepush.md.' >&2
    exit 127
}
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("pre-push: Node >=22 is required."); process.exit(1); }'
[ -f node_modules/typescript/bin/tsc ] || {
    echo 'pre-push: installed TypeScript is missing; run npm run setup:dev.' >&2
    exit 1
}
# Preserve the existing tsconfig roots and every option; emit no build output.
exec node node_modules/typescript/bin/tsc --noEmit
