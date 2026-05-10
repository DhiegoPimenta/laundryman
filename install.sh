#!/usr/bin/env bash
# 🧺 laundryman — install.sh
# Registers MCP server + PostToolUse hook in ~/.claude/settings.json
#
# Usage:
#   bash install.sh            # install
#   bash install.sh --uninstall  # remove

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo ".")"
HOOK_DIR="$HOME/.claude/hooks"
HOOK_FILE="$HOOK_DIR/laundryman.js"
LAUNDRYMAN_DIR="$HOME/.claude/laundryman"
MCP_FILE="$LAUNDRYMAN_DIR/mcp/laundryman-mcp.js"
SETTINGS="$HOME/.claude/settings.json"
REPO_HOOK="$SCRIPT_DIR/hooks/laundryman.js"
REPO_MCP="$SCRIPT_DIR/mcp/laundryman-mcp.js"
REPO_PKG="$SCRIPT_DIR/package.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

say()  { echo -e "${CYAN}$*${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }
err()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

CLAUDE_MD_TEMPLATE='## Tool preferences (laundryman)

When running any test suite, always use `laundryman:run_tests` instead of Bash directly.
Example: `laundryman:run_tests(path=".", runner="pytest")`

When checking container logs, always use `laundryman:run_docker_logs` instead of Bash directly.
Example: `laundryman:run_docker_logs(container="myapp")`

These tools return pre-filtered output — errors and warnings only, no noise.
Do not run pytest / jest / cargo test / docker logs directly via Bash.'

# ── Uninstall ──────────────────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
  say "🧺 laundryman — uninstalling..."
  rm -f "$HOOK_FILE"
  rm -rf "$LAUNDRYMAN_DIR"
  if command -v python3 &>/dev/null && [ -f "$SETTINGS" ]; then
    python3 - "$SETTINGS" <<'PYEOF'
import json, sys
path = sys.argv[1]
with open(path) as f: cfg = json.load(f)
hooks = cfg.get("hooks", {})
ptu = hooks.get("PostToolUse", [])
ptu = [h for h in ptu if "laundryman" not in str(h)]
if ptu: hooks["PostToolUse"] = ptu
else: hooks.pop("PostToolUse", None)
ups = hooks.get("UserPromptSubmit", [])
ups = [h for h in ups if "laundryman" not in str(h) and "input-cleaner" not in str(h)]
if ups: hooks["UserPromptSubmit"] = ups
else: hooks.pop("UserPromptSubmit", None)
if not hooks: cfg.pop("hooks", None)
else: cfg["hooks"] = hooks
mcps = cfg.get("mcpServers", {})
mcps.pop("laundryman", None)
if not mcps: cfg.pop("mcpServers", None)
else: cfg["mcpServers"] = mcps
with open(path, "w") as f: json.dump(cfg, f, indent=2)
PYEOF
  fi
  ok "laundryman removed."
  exit 0
fi

# ── Install ────────────────────────────────────────────────────────────
say ""
say "🧺 laundryman — washing noisy Claude Code output"
say "──────────────────────────────────────────────"

if ! command -v node &>/dev/null; then
  err "Node.js not found. Install it at https://nodejs.org"
fi
ok "Node.js $(node --version) found"

if [ ! -f "$REPO_HOOK" ]; then
  err "Cannot find hooks/laundryman.js — run install.sh from the cloned repo directory."
fi
if [ ! -f "$REPO_MCP" ]; then
  err "Cannot find mcp/laundryman-mcp.js — run install.sh from the cloned repo directory."
fi

# Copy PostToolUse hook to ~/.claude/hooks/
mkdir -p "$HOOK_DIR"
cp "$REPO_HOOK" "$HOOK_FILE"
chmod +x "$HOOK_FILE"
ok "Hook copied to $HOOK_FILE"

# Copy MCP server into self-contained ~/.claude/laundryman/
# Structure mirrors the repo so relative requires keep working:
#   mcp/laundryman-mcp.js uses ../hooks/laundryman.js → resolved correctly
#   @modelcontextprotocol/sdk resolved from node_modules/ in this dir
mkdir -p "$LAUNDRYMAN_DIR/mcp" "$LAUNDRYMAN_DIR/hooks"
cp "$REPO_MCP"  "$LAUNDRYMAN_DIR/mcp/laundryman-mcp.js"
cp "$REPO_HOOK" "$LAUNDRYMAN_DIR/hooks/laundryman.js"
cp "$REPO_PKG"  "$LAUNDRYMAN_DIR/package.json"
say "Installing MCP dependencies in $LAUNDRYMAN_DIR..."
(cd "$LAUNDRYMAN_DIR" && npm install --silent 2>/dev/null)
ok "MCP server installed at $MCP_FILE"

# Patch settings.json
if ! command -v python3 &>/dev/null; then
  warn "python3 not found — add entries manually to $SETTINGS"
  warn "See README.md and docs/mcp-mode.md for the JSON snippets."
  exit 0
fi

python3 - "$SETTINGS" "$HOOK_FILE" "$MCP_FILE" <<'PYEOF'
import json, sys, os

settings_path = sys.argv[1]
hook_path     = sys.argv[2]
mcp_path      = sys.argv[3]

if os.path.exists(settings_path):
    with open(settings_path) as f:
        cfg = json.load(f)
else:
    cfg = {}

# PostToolUse hook
hooks = cfg.setdefault("hooks", {})
ptu   = hooks.setdefault("PostToolUse", [])
if not any("laundryman" in str(h) for h in ptu):
    ptu.append({"hooks": [{"type": "command", "command": f"node {hook_path}"}]})

# MCP server — always update path to the stable installed location
mcps = cfg.setdefault("mcpServers", {})
mcps["laundryman"] = {"command": "node", "args": [mcp_path]}

os.makedirs(os.path.dirname(settings_path), exist_ok=True)
with open(settings_path, "w") as f:
    json.dump(cfg, f, indent=2)
PYEOF

ok "MCP server registered in $SETTINGS"
ok "PostToolUse hook registered in $SETTINGS"

say ""
say "──────────────────────────────────────────────"
warn "Hook mode note (PostToolUse):"
warn "  Uses additionalContext today — the original output still"
warn "  reaches Claude alongside the filtered version."
warn "  This is additive, not a true replacement."
warn "  True replacement activates automatically when Anthropic"
warn "  ships replaceToolOutput (issue #36843)."
say ""
say "  ✓ MCP mode gives you true replacement today."
say "    Answer 'y' below to add it to your CLAUDE.md."
say ""
say "──────────────────────────────────────────────"

printf "${CYAN}Create a CLAUDE.md template with MCP instructions? (y/n): ${NC}"
if read -r answer < /dev/tty 2>/dev/null; then
  :
else
  answer="n"
fi

if [[ "$answer" =~ ^[Yy]$ ]]; then
  if [ -f "CLAUDE.md" ]; then
    printf '%s\n' "$CLAUDE_MD_TEMPLATE" > laundryman-claude-template.md
    ok "Created laundryman-claude-template.md"
    warn "CLAUDE.md already exists — append the template manually:"
    say "  cat laundryman-claude-template.md >> CLAUDE.md"
  else
    printf '%s\n' "$CLAUDE_MD_TEMPLATE" > CLAUDE.md
    ok "Created CLAUDE.md with MCP instructions."
  fi
fi

say ""
say "  Restart Claude Code to activate MCP mode."
say "  If MCP stops working, run bash install.sh again to restore paths."
say "  Uninstall anytime: bash install.sh --uninstall"
say ""
