#!/usr/bin/env bash
# 🧺 laundryman — install.sh
# Installs the PostToolUse hook into ~/.claude/settings.json
#
# Usage:
#   bash install.sh            # install
#   bash install.sh --uninstall  # remove

set -e

HOOK_DIR="$HOME/.claude/hooks"
HOOK_FILE="$HOOK_DIR/laundryman.js"
SETTINGS="$HOME/.claude/settings.json"
REPO_HOOK="$(cd "$(dirname "$0")" && pwd)/hooks/laundryman.js"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

say()  { echo -e "${CYAN}$*${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── Uninstall ────────────────────────────────────────────────────────
if [[ "$1" == "--uninstall" ]]; then
  say "🧺 laundryman — uninstalling..."
  rm -f "$HOOK_FILE"
  if command -v python3 &>/dev/null && [ -f "$SETTINGS" ]; then
    python3 - "$SETTINGS" <<'EOF'
import json, sys
path = sys.argv[1]
with open(path) as f: cfg = json.load(f)
hooks = cfg.get("hooks", {})
ptu = hooks.get("PostToolUse", [])
ptu = [h for h in ptu if "laundryman" not in str(h)]
if ptu: hooks["PostToolUse"] = ptu
else: hooks.pop("PostToolUse", None)
if not hooks: cfg.pop("hooks", None)
else: cfg["hooks"] = hooks
with open(path, "w") as f: json.dump(cfg, f, indent=2)
EOF
  fi
  ok "laundryman removed."
  exit 0
fi

# ── Install ──────────────────────────────────────────────────────────
say ""
say "🧺 laundryman — washing noisy Claude Code output"
say "─────────────────────────────────────────────"

# Check node
if ! command -v node &>/dev/null; then
  err "Node.js not found. Install it at https://nodejs.org"
fi
ok "Node.js $(node --version) found"

# Copy hook file
mkdir -p "$HOOK_DIR"
cp "$REPO_HOOK" "$HOOK_FILE"
chmod +x "$HOOK_FILE"
ok "Hook installed at $HOOK_FILE"

# Patch settings.json
if ! command -v python3 &>/dev/null; then
  warn "python3 not found — add the hook manually to $SETTINGS"
  warn "See README.md for the JSON snippet."
  exit 0
fi

python3 - "$SETTINGS" "$HOOK_FILE" <<'EOF'
import json, sys, os

settings_path = sys.argv[1]
hook_path = sys.argv[2]

# Load or create settings
if os.path.exists(settings_path):
    with open(settings_path) as f:
        cfg = json.load(f)
else:
    cfg = {}

hooks = cfg.setdefault("hooks", {})
ptu = hooks.setdefault("PostToolUse", [])

hook_entry = {
    "hooks": [{
        "type": "command",
        "command": f"node {hook_path}"
    }]
}

# Avoid duplicates
already = any("laundryman" in str(h) for h in ptu)
if not already:
    ptu.append(hook_entry)
    cfg["hooks"]["PostToolUse"] = ptu

os.makedirs(os.path.dirname(settings_path), exist_ok=True)
with open(settings_path, "w") as f:
    json.dump(cfg, f, indent=2)
EOF

ok "Registered in $SETTINGS"
say ""
say "─────────────────────────────────────────────"
ok "🧺 laundryman is running. Dirty output goes in, clean comes out."
say ""
say "  Run a noisy command in Claude Code to see it in action:"
say "  → pytest -v"
say "  → npm test"
say "  → cargo build"
say ""
say "  Uninstall anytime: bash install.sh --uninstall"
say ""
