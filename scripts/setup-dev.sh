#!/bin/sh
# Explicit contributor setup; ordinary npm ci does not install hooks.
set -eu
cd "$(dirname "$0")/.."
for tool in git python3 node npm; do
    command -v "$tool" >/dev/null 2>&1 || {
        echo "setup: $tool is required; see docs/prepush.md." >&2
        exit 127
    }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("setup: Node >=22 is required."); process.exit(1); }'
npm ci
exec python3 -I scripts/prepush/install.py
