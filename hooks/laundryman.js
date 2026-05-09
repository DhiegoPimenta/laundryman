#!/usr/bin/env node
/**
 * 🧺 laundryman — PostToolUse hook for Claude Code
 * Washes noisy tool output. Only stains (errors/warnings) remain.
 *
 * How it works:
 *   Claude Code calls this script after every tool execution.
 *   We read the JSON payload from stdin, detect the command type,
 *   filter the output, and print a compressed version back.
 *   Claude sees only what matters — failures, warnings, summaries.
 *
 * Token savings (approximate):
 *   pytest -v      →  up to 90% reduction
 *   npm test       →  up to 80% reduction
 *   cargo build    →  up to 70% reduction
 *   docker logs    →  up to 85% reduction
 *
 * -------------------------------------------------------------------
 * 🇧🇷 Como funciona:
 *   O Claude Code chama este script após cada execução de ferramenta.
 *   Lemos o payload JSON do stdin, detectamos o tipo de comando,
 *   filtramos o output e devolvemos uma versão comprimida.
 *   O Claude vê apenas o que importa — falhas, warnings, resumos.
 * -------------------------------------------------------------------
 */

const readline = require("readline");

// ── Helpers ──────────────────────────────────────────────────────────

function countLines(text) {
  return text ? text.split("\n").length : 0;
}

function summarize(original, filtered) {
  const before = countLines(original);
  const after = countLines(filtered);
  const saved = before - after;
  const pct = before > 0 ? Math.round((saved / before) * 100) : 0;
  return `[🧺 laundryman] ${before} lines → ${after} lines (${pct}% washed)\n`;
}

// ── Filters ──────────────────────────────────────────────────────────

/**
 * pytest / unittest
 * Removes: PASSED lines, dots progress, platform/rootdir/plugin noise
 * Keeps:   FAILED, ERROR, WARNING, summary line, tracebacks
 */
function filterPytest(output) {
  return output
    .split("\n")
    .filter((line) => {
      if (/^PASSED\b/.test(line))         return false; // PASSED test_x .... 0.001s
      if (/^collecting /.test(line))      return false; // collecting ...
      if (/^platform /.test(line))        return false; // platform linux -- Python 3.x
      if (/^rootdir:/.test(line))         return false; // rootdir: /home/...
      if (/^plugins:/.test(line))         return false; // plugins: anyio-x.x
      if (/^cacheprovider/.test(line))    return false; // cacheprovider: ...
      if (/^\.+\s*$/.test(line.trim()))  return false; // lines of just dots
      return true;
    })
    .join("\n");
}

/**
 * npm test / jest / vitest / mocha
 * Removes: ✓ passing tests, per-test timing
 * Keeps:   ✗ failures, FAIL files, summary, console.error
 */
function filterNpmTest(output) {
  const lines = output.split("\n");
  const kept = [];

  for (const line of lines) {
    const isNoise =
      /^\s*(✓|✔|√)\s/.test(line) ||              // passing checkmarks
      /^\s*✓/.test(line) ||                        // bare checkmarks
      /^\s*\d+ms$/.test(line.trim());              // standalone timing

    const isImportant =
      /^\s*(✗|✘|×|✕|●)\s/.test(line) ||          // failing tests
      /^\s*console\.(error|warn)/.test(line) ||    // console errors
      /\d+ (passing|failing|pending)/.test(line) || // mocha summary
      /Tests:\s+\d+/.test(line) ||                 // jest summary
      /^FAIL\s+/.test(line) ||                     // failed file header
      /Error:/.test(line) ||                       // error messages
      /Expected|Received/.test(line);              // assertion diff

    if (isImportant || !isNoise) kept.push(line);
  }

  return kept.join("\n");
}

/**
 * cargo build / cargo test / cargo check
 * Removes: "Compiling X v0.0.0", "Downloaded", "Updating" lines
 * Keeps:   warnings, errors, test results
 */
function filterCargo(output) {
  return output
    .split("\n")
    .filter((line) => {
      if (/^\s*Compiling\s/.test(line))   return false;
      if (/^\s*Downloaded\s/.test(line))  return false;
      if (/^\s*Updating\s/.test(line))    return false;
      if (/^\s*Finished\s+dev/.test(line)) return false;
      return true;
    })
    .join("\n");
}

/**
 * docker logs / docker-compose logs
 * Removes: INFO health check lines, routine GET / access logs
 * Keeps:   ERROR, WARN, FATAL, CRITICAL, stack traces
 */
function filterDocker(output) {
  return output
    .split("\n")
    .filter((line) => {
      const isHealthNoise = /GET \/ HTTP/.test(line);
      const isInfoNoise =
        /\bINFO\b/i.test(line) && !/error|warn|fail/i.test(line);

      const isImportant =
        /\b(ERROR|WARN|FATAL|CRITICAL|EXCEPTION|TRACEBACK|panic)\b/i.test(line);

      return isImportant || (!isHealthNoise && !isInfoNoise);
    })
    .join("\n");
}

/**
 * git commands — already concise, just collapse blank clusters
 */
function filterGit(output) {
  return output.replace(/\n{3,}/g, "\n\n");
}

/**
 * Generic fallback — strip ANSI codes + collapse blank lines
 */
function filterGeneric(output) {
  return output
    .replace(/\x1b\[[0-9;]*m/g, "")  // strip ANSI escape codes
    .replace(/\n{3,}/g, "\n\n");      // collapse blank clusters
}

// ── Router ───────────────────────────────────────────────────────────

function detectAndFilter(command, output) {
  if (!output || output.trim() === "") return output;

  const cmd = (command || "").toLowerCase().trim();

  if (/pytest|python -m pytest|unittest/.test(cmd))  return filterPytest(output);
  if (/npm (test|run test)|jest|vitest|mocha/.test(cmd)) return filterNpmTest(output);
  if (/cargo (test|build|check)/.test(cmd))          return filterCargo(output);
  if (/docker/.test(cmd))                            return filterDocker(output);
  if (/^git /.test(cmd))                             return filterGit(output);

  return filterGeneric(output);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({ input: process.stdin });
  const lines = [];

  for await (const line of rl) {
    lines.push(line);
  }

  let payload;
  try {
    payload = JSON.parse(lines.join("\n"));
  } catch {
    process.exit(0);
  }

  // Only act on Bash tool
  if (payload.tool_name !== "Bash") process.exit(0);

  const command = payload.tool_input?.command || "";
  const output  = payload.tool_response?.output || "";

  // Skip if output is tiny
  if (countLines(output) < 10) process.exit(0);

  const filtered = detectAndFilter(command, output);
  const header   = summarize(output, filtered);

  // NOTE: Today we use additionalContext because Claude Code's PostToolUse
  // does not yet support full output replacement.
  // When Anthropic ships replaceToolOutput, we'll switch here.
  // Track: https://github.com/anthropics/claude-code/issues/53330
  const result = {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: header + filtered,
    },
  };

  console.log(JSON.stringify(result));
  process.exit(0);
}

main().catch(() => process.exit(0));
