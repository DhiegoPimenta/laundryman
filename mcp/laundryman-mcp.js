#!/usr/bin/env node
// mcp/laundryman-mcp.js — MCP server exposing run_tests and run_docker_logs
//
// True output replacement: Claude receives only the filtered output.
// When Claude calls an MCP tool, the returned content IS the result —
// no original noise is attached alongside it.
//
// Setup: see docs/mcp-mode.md

"use strict";

const { Server }             = require("@modelcontextprotocol/sdk/server");
const { execSync }           = require("child_process");
const { existsSync, readFileSync } = require("fs");
const { join, resolve }      = require("path");

// Resolve sibling dist files that aren't in the SDK export map
const _sdkCjs = resolve(require.resolve("@modelcontextprotocol/sdk/server"), "../../");
const { StdioServerTransport } = require(join(_sdkCjs, "server", "stdio.js"));
const { ListToolsRequestSchema, CallToolRequestSchema } = require(join(_sdkCjs, "types.js"));

const { filterPytest, filterNpmTest, filterCargo, filterDocker } =
  require("../hooks/laundryman.js");

// ── Test runner detection — priority order ────────────────────────────

function detectTestRunner(dir) {
  const p = resolve(dir);
  const found = [];

  if (existsSync(join(p, "pyproject.toml")) ||
      existsSync(join(p, "pytest.ini"))     ||
      existsSync(join(p, "setup.py"))) {
    found.push("pytest");
  }
  if (existsSync(join(p, "package.json"))) {
    try {
      const pkg = JSON.parse(readFileSync(join(p, "package.json"), "utf8"));
      if (pkg.scripts?.test) found.push("jest");
    } catch {}
  }
  if (existsSync(join(p, "Cargo.toml"))) found.push("cargo");
  if (existsSync(join(p, "go.mod")))     found.push("go");

  return found;
}

// ── Command runner — captures output even on non-zero exit ────────────

function runCommand(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, timeout: 120_000, encoding: "utf8" });
  } catch (err) {
    return [err.stdout || "", err.stderr || ""].filter(Boolean).join("\n");
  }
}

// ── Tool implementations ──────────────────────────────────────────────

const RUNNERS = {
  pytest: { cmd: "python -m pytest -v", filter: filterPytest },
  jest:   { cmd: "npm test",            filter: filterNpmTest },
  cargo:  { cmd: "cargo test",          filter: filterCargo   },
  go:     { cmd: "go test ./...",        filter: (o) => o      },
};

function toolRunTests(args) {
  const dir = resolve(args.path || ".");

  let runner = args.runner;
  if (!runner) {
    const detected = detectTestRunner(dir);
    if (detected.length === 0) {
      return (
        "No test runner detected in " + dir + ".\n" +
        "Looked for: pyproject.toml/pytest.ini (pytest), package.json with test script (jest), " +
        "Cargo.toml (cargo), go.mod (go).\n" +
        "Pass the runner argument to override: pytest | jest | cargo | go"
      );
    }
    if (detected.length > 1) {
      return (
        "Multiple test runners detected in " + dir + ": " + detected.join(", ") + ".\n" +
        "Specify runner argument: pytest | jest | cargo | go"
      );
    }
    runner = detected[0];
  }

  if (!RUNNERS[runner]) {
    return "Unknown runner \"" + runner + "\". Valid options: " + Object.keys(RUNNERS).join(", ");
  }

  const { cmd, filter } = RUNNERS[runner];
  const raw      = runCommand(cmd, dir);
  const filtered = filter(raw);
  const before   = raw.split("\n").length;
  const after    = filtered.split("\n").length;
  const pct      = before > 0 ? Math.round(((before - after) / before) * 100) : 0;

  return "[🧺 laundryman | " + runner + "] " + before + " lines → " + after + " lines (" + pct + "% filtered)\n\n" + filtered;
}

function toolDockerLogs(args) {
  const container = args.container;
  const tail      = args.tail ?? 100;
  const raw       = runCommand("docker logs --tail " + tail + " " + container, process.cwd());
  const filtered  = filterDocker(raw);
  const before    = raw.split("\n").length;
  const after     = filtered.split("\n").length;
  const pct       = before > 0 ? Math.round(((before - after) / before) * 100) : 0;

  return "[🧺 laundryman | docker] " + before + " lines → " + after + " lines (" + pct + "% filtered)\n\n" + filtered;
}

// ── MCP server ────────────────────────────────────────────────────────

const server = new Server(
  { name: "laundryman", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "run_tests",
      description:
        "Run the project test suite with noise filtered. " +
        "Returns only failures, errors, and the summary — not passing tests. " +
        "Supports pytest, jest/npm test, cargo test, go test. " +
        "Auto-detects runner from project files if runner argument is omitted.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory to run tests in (absolute or relative to cwd). Required."
          },
          runner: {
            type: "string",
            enum: ["pytest", "jest", "cargo", "go"],
            description: "Test runner override. Auto-detected from project files if omitted."
          }
        },
        required: ["path"]
      }
    },
    {
      name: "run_docker_logs",
      description:
        "Fetch container logs with INFO/healthcheck noise filtered. " +
        "Returns only ERROR, WARN, FATAL, CRITICAL lines.",
      inputSchema: {
        type: "object",
        properties: {
          container: {
            type: "string",
            description: "Container name or ID. Required."
          },
          tail: {
            type: "number",
            description: "Number of log lines to fetch (default: 100)."
          }
        },
        required: ["container"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let text;
    if      (name === "run_tests")       text = toolRunTests(args);
    else if (name === "run_docker_logs") text = toolDockerLogs(args);
    else return { content: [{ type: "text", text: "Unknown tool: " + name }], isError: true };
    return { content: [{ type: "text", text }] };
  } catch (err) {
    return { content: [{ type: "text", text: "Error: " + err.message }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write("laundryman-mcp fatal: " + err.message + "\n");
  process.exit(1);
});
