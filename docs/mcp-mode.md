# MCP mode — true output replacement today

## Why MCP solves what the hook cannot

The `PostToolUse` hook today uses `additionalContext`: the filtered summary is injected
**alongside** the original output, not instead of it. Claude sees both.

When Claude calls an **MCP tool**, the returned content IS the result — there is no
original output attached. This gives laundryman true replacement right now, without
waiting for any new Anthropic API.

```
Hook mode (today):   original 518 lines  +  17 lines filtered  =  535 lines to Claude
MCP mode (today):    17 lines filtered only                     =  17 lines to Claude
```

## The three modes

| Mode | How | Today | Future |
|------|-----|-------|--------|
| 🔧 **Hook** (automatic) | PostToolUse fires on every Bash call | additionalContext — original still goes to Claude | `replaceToolOutput` ships → automatic true replacement |
| 🚀 **MCP** (opt-in) | Claude explicitly calls `laundryman:run_tests` | **True replacement — works now** | Same, already optimal |
| ⚡ **Hook v2** (coming) | Automatic, no instruction needed | — | `updatedBuiltinToolOutput` via [issue #36843](https://github.com/anthropics/claude-code/issues/36843) |

## Manual setup

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "laundryman": {
      "command": "node",
      "args": ["/absolute/path/to/laundryman/mcp/laundryman-mcp.js"]
    }
  }
}
```

Replace `/absolute/path/to/laundryman` with the actual path where you cloned the repo.

## CLAUDE.md template

Add this to your project's `CLAUDE.md` to make Claude prefer laundryman tools automatically:

```markdown
## Tool preferences

When running any test suite, always use `laundryman:run_tests` instead of Bash.
Example: `laundryman:run_tests(path=".")`

When checking container logs, always use `laundryman:run_docker_logs` instead of Bash.
Example: `laundryman:run_docker_logs(container="myapp")`

These tools return pre-filtered output — failures and warnings only, no PASSED noise.
Do not run pytest / jest / cargo test / docker logs directly via Bash.
```

## Tools reference

### `run_tests`

Runs the project test suite with noise filtered. Returns only failures, errors, and summary.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | string | ✓ | Directory to run tests in |
| `runner` | `pytest` \| `jest` \| `cargo` \| `go` | — | Override auto-detection |

**Auto-detection priority** (when `runner` is omitted):
1. `pyproject.toml` / `pytest.ini` / `setup.py` → `pytest`
2. `package.json` with `scripts.test` → `jest`
3. `Cargo.toml` → `cargo test`
4. `go.mod` → `go test ./...`

If multiple runners are detected, laundryman asks you to specify.

### `run_docker_logs`

Fetches container logs with INFO/healthcheck lines filtered out.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `container` | string | ✓ | Container name or ID |
| `tail` | number | — | Lines to fetch (default: 100) |

## Testing the server

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector node /path/to/laundryman/mcp/laundryman-mcp.js
```

Or connect directly via Claude Code after adding to `settings.json` and restarting.
