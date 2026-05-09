# 🧺 laundryman — install.ps1
# Installs the PostToolUse hook into ~/.claude/settings.json (Windows)
#
# Usage:
#   .\install.ps1            # install
#   .\install.ps1 -Uninstall # remove

param([switch]$Uninstall)

$HookDir     = "$env:USERPROFILE\.claude\hooks"
$HookFile    = "$HookDir\laundryman.js"
$Settings    = "$env:USERPROFILE\.claude\settings.json"
$RepoHook    = Join-Path $PSScriptRoot "hooks\laundryman.js"

function Ok($msg)   { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }
function Say($msg)  { Write-Host $msg -ForegroundColor Cyan }

if ($Uninstall) {
    Say "🧺 laundryman — uninstalling..."
    if (Test-Path $HookFile    = "$HookDir\laundryman.js"
    if (Test-Path $Settings) {
        $cfg = Get-Content $Settings | ConvertFrom-Json
        if ($cfg.hooks.PostToolUse) {
            $cfg.hooks.PostToolUse = @($cfg.hooks.PostToolUse | Where-Object { $_ -notmatch "laundryman" })
        }
        $cfg | ConvertTo-Json -Depth 10 | Set-Content $Settings
    }
    Ok "laundryman removed."
    exit 0
}

Say ""
Say "🧺 laundryman — washing noisy Claude Code output"
Say "─────────────────────────────────────────────"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Err "Node.js not found. Install at https://nodejs.org"
}
Ok "Node.js $(node --version) found"

New-Item -ItemType Directory -Force -Path $HookDir | Out-Null
Copy-Item $RepoHook    = Join-Path $PSScriptRoot "hooks\laundryman.js"
Ok "Hook installed at $HookFile    = "$HookDir\laundryman.js"

# Patch settings.json
$hookEntry = @{ hooks = @(@{ type = "command"; command = "node $HookFile    = "$HookDir\laundryman.js"

if (Test-Path $Settings) {
    $cfg = Get-Content $Settings -Raw | ConvertFrom-Json
} else {
    $cfg = @{}
}

if (-not $cfg.hooks) { $cfg | Add-Member -NotePropertyName hooks -NotePropertyValue @{} }
if (-not $cfg.hooks.PostToolUse) { $cfg.hooks | Add-Member -NotePropertyName PostToolUse -NotePropertyValue @() }

$alreadyInstalled = $cfg.hooks.PostToolUse | Where-Object { $_ -match "laundryman" }
if (-not $alreadyInstalled) {
    $cfg.hooks.PostToolUse += $hookEntry
}

New-Item -ItemType Directory -Force -Path (Split-Path $Settings) | Out-Null
$cfg | ConvertTo-Json -Depth 10 | Set-Content $Settings

Ok "Registered in $Settings"
Say ""
Say "─────────────────────────────────────────────"
Ok "🧺 laundryman is running. Dirty output goes in, clean comes out."
Say ""
Say "  Uninstall: .\install.ps1 -Uninstall"
Say ""
