#!/usr/bin/env bash
# bootstrap.sh: check the tools this repo needs and, with --browser, install
# Playwright and headless Chromium for screenshots (scripts/shots.mjs).
# The game and its tests need only Node 20+; nothing is installed into the repo.
# Browser tooling goes to $DIG_TEST_DIR (default ~/.local/share/dig-test).
set -u
cd "$(dirname "$0")/.."

ok=1
if command -v node >/dev/null 2>&1; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$major" -ge 20 ]; then echo "node $(node --version): ok"; else echo "node $(node --version): need 20 or newer"; ok=0; fi
else
  echo "node: not found (need 20 or newer)"; ok=0
fi
command -v git >/dev/null 2>&1 && echo "git: ok" || echo "git: not found"

if [ "${1:-}" = "--browser" ]; then
  dir="${DIG_TEST_DIR:-$HOME/.local/share/dig-test}"
  mkdir -p "$dir"
  if [ -d "$dir/node_modules/playwright" ]; then
    echo "playwright: already in $dir"
  else
    echo "installing playwright into $dir"
    [ -f "$dir/package.json" ] || echo '{"name":"dig-test","private":true}' > "$dir/package.json"
    (cd "$dir" && npm install --silent --no-audit --no-fund playwright@1.56.1) || { echo "playwright: npm install failed (no network?)"; exit 0; }
  fi
  # Ubuntu releases newer than Playwright knows (e.g. 26.04) take the 24.04 build.
  if (cd "$dir" && npx --yes playwright install --only-shell chromium >/dev/null 2>&1) \
    || (cd "$dir" && PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx --yes playwright install --only-shell chromium >/dev/null 2>&1); then
    echo "chromium: ok"
  else
    echo "chromium: download failed; screenshots unavailable (tests still run)"
  fi
fi

[ "$ok" = 1 ] && echo "ready: npm test, npm run serve" || exit 1
