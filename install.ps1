# 🧺 laundryman — install.ps1
# Registers MCP server + PostToolUse hook in ~/.claude/settings.json (Windows)
#
# Usage:
#   .\install.ps1            # install
#   .\install.ps1 -Uninstall # remove

param([switch]$Uninstall)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HookDir   = "$env:USERPROFILE\.claude\hooks"
$HookFile  = "$HookDir\laundryman.js"
$Settings  = "$env:USERPROFILE\.claude\settings.json"
$RepoHook  = Join-Path $ScriptDir "hooks\laundryman.js"
$RepoMcp   = Join-Path $ScriptDir "mcp\laundryman-mcp.js"

function Ok($msg)   { Write-Host "✓ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "⚠  $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }
function Say($msg)  { Write-Host $msg -ForegroundColor Cyan }

$ClaudeMdTemplate = @'
## Tool preferences (laundryman)

When running any test suite, always use `laundryman:run_tests` instead of Bash directly.
Example: `laundryman:run_tests(path=".", runner="pytest")`

When checking container logs, always use `laundryman:run_docker_logs` instead of Bash directly.
Example: `laundryman:run_docker_logs(container="myapp")`

These tools return pre-filtered output — errors and warnings only, no noise.
Do not run pytest / jest / cargo test / docker logs directly via Bash.
'@

# ── Uninstall ──────────────────────────────────────────────────────────
if ($Uninstall) {
    Say "🧺 laundryman — uninstalling..."
    if (Test-Path $HookFile) { Remove-Item $HookFile -Force }

    if (Test-Path $Settings) {
        $cfg = Get-Content $Settings -Raw | ConvertFrom-Json

        # Remove PostToolUse hook
        if ($cfg.hooks -and $cfg.hooks.PostToolUse) {
            $filtered = @($cfg.hooks.PostToolUse | Where-Object {
                ($_ | ConvertTo-Json -Compress) -notmatch "laundryman"
            })
            if ($filtered.Count -gt 0) {
                $cfg.hooks.PostToolUse = $filtered
            } else {
                $cfg.hooks.PSObject.Properties.Remove('PostToolUse')
            }
        }

        # Remove UserPromptSubmit hook (in case installed from older version)
        if ($cfg.hooks -and $cfg.hooks.UserPromptSubmit) {
            $filtered = @($cfg.hooks.UserPromptSubmit | Where-Object {
                ($_ | ConvertTo-Json -Compress) -notmatch "laundryman|input-cleaner"
            })
            if ($filtered.Count -gt 0) {
                $cfg.hooks.UserPromptSubmit = $filtered
            } else {
                $cfg.hooks.PSObject.Properties.Remove('UserPromptSubmit')
            }
        }

        # Remove MCP server
        if ($cfg.mcpServers -and $cfg.mcpServers.PSObject.Properties['laundryman']) {
            $cfg.mcpServers.PSObject.Properties.Remove('laundryman')
        }

        $cfg | ConvertTo-Json -Depth 10 | Set-Content $Settings -Encoding utf8
    }
    Ok "laundryman removed."
    exit 0
}

# ── Install ────────────────────────────────────────────────────────────
Say ""
Say "🧺 laundryman — washing noisy Claude Code output"
Say "──────────────────────────────────────────────"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Err "Node.js not found. Install at https://nodejs.org"
}
Ok "Node.js $(node --version) found"

if (-not (Test-Path $RepoHook)) { Err "Cannot find hooks\laundryman.js — run install.ps1 from the cloned repo directory." }
if (-not (Test-Path $RepoMcp))  { Err "Cannot find mcp\laundryman-mcp.js — run install.ps1 from the cloned repo directory." }

# Install npm dependencies (MCP server needs @modelcontextprotocol/sdk)
$pkgJson = Join-Path $ScriptDir "package.json"
if (Test-Path $pkgJson) {
    Say "Installing npm dependencies..."
    Push-Location $ScriptDir
    npm install --silent 2>$null
    Pop-Location
    Ok "Dependencies installed"
}

# Copy hook file
New-Item -ItemType Directory -Force -Path $HookDir | Out-Null
Copy-Item $RepoHook $HookFile -Force
Ok "Hook copied to $HookFile"

# Load or create settings.json
if (Test-Path $Settings) {
    $cfg = Get-Content $Settings -Raw | ConvertFrom-Json
} else {
    $cfg = [PSCustomObject]@{}
}

# Ensure hooks object
if (-not $cfg.PSObject.Properties['hooks']) {
    $cfg | Add-Member -NotePropertyName hooks -NotePropertyValue ([PSCustomObject]@{})
}
if (-not $cfg.hooks.PSObject.Properties['PostToolUse']) {
    $cfg.hooks | Add-Member -NotePropertyName PostToolUse -NotePropertyValue @()
}

# Add PostToolUse hook if not already present
$alreadyHook = $cfg.hooks.PostToolUse | Where-Object {
    ($_ | ConvertTo-Json -Compress) -match "laundryman"
}
if (-not $alreadyHook) {
    $hookEntry = [PSCustomObject]@{
        hooks = @([PSCustomObject]@{ type = "command"; command = "node $HookFile" })
    }
    $cfg.hooks.PostToolUse = @($cfg.hooks.PostToolUse) + @($hookEntry)
}

# Ensure mcpServers object
if (-not $cfg.PSObject.Properties['mcpServers']) {
    $cfg | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([PSCustomObject]@{})
}

# Add MCP server if not already present
if (-not $cfg.mcpServers.PSObject.Properties['laundryman']) {
    $mcpEntry = [PSCustomObject]@{
        command = "node"
        args    = @($RepoMcp)
    }
    $cfg.mcpServers | Add-Member -NotePropertyName laundryman -NotePropertyValue $mcpEntry
}

New-Item -ItemType Directory -Force -Path (Split-Path $Settings) | Out-Null
$cfg | ConvertTo-Json -Depth 10 | Set-Content $Settings -Encoding utf8

Ok "MCP server registered in $Settings"
Ok "PostToolUse hook registered in $Settings"

Say ""
Say "──────────────────────────────────────────────"
Warn "Hook mode note (PostToolUse):"
Warn "  Uses additionalContext today — the original output still"
Warn "  reaches Claude alongside the filtered version."
Warn "  This is additive, not a true replacement."
Warn "  True replacement activates automatically when Anthropic"
Warn "  ships replaceToolOutput (issue #36843)."
Say ""
Say "  ✓ MCP mode gives you true replacement today."
Say "    Answer 'y' below to add it to your CLAUDE.md."
Say ""
Say "──────────────────────────────────────────────"

$answer = Read-Host "Create a CLAUDE.md template with MCP instructions? (y/n)"
if ($answer -match '^[Yy]') {
    if (Test-Path "CLAUDE.md") {
        $ClaudeMdTemplate | Out-File "laundryman-claude-template.md" -Encoding utf8
        Ok "Created laundryman-claude-template.md"
        Warn "CLAUDE.md already exists — append the template manually:"
        Say "  Get-Content laundryman-claude-template.md | Add-Content CLAUDE.md"
    } else {
        $ClaudeMdTemplate | Out-File "CLAUDE.md" -Encoding utf8
        Ok "Created CLAUDE.md with MCP instructions."
    }
}

Say ""
Say "  Restart Claude Code to activate MCP mode."
Say "  Uninstall anytime: .\install.ps1 -Uninstall"
Say ""
