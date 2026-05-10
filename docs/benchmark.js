#!/usr/bin/env node
// Token savings benchmark for laundryman.
// Run with: node docs/benchmark.js

const { detectAndFilter } = require("../hooks/laundryman");

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

function bench(label, command, lines) {
  const output   = lines.join("\n");
  const filtered = detectAndFilter(command, output);
  const baseline = estimateTokens(output);    // tokens WITHOUT laundryman
  const context  = estimateTokens(filtered);  // tokens in the additionalContext laundryman injects
  const today    = baseline + context;        // additionalContext is ADDITIVE — Claude sees both
  const future   = context;                  // with replaceToolOutput, original is suppressed
  const nowPct   = Math.round(((baseline - today)  / baseline) * 100); // negative = overhead today
  const laterPct = Math.round(((baseline - future) / baseline) * 100); // real saving in the future
  return { label, baseline, context, today, future, nowPct, laterPct };
}

// ── Payload generators ────────────────────────────────────────────────

function pytestPayload() {
  const lines = [
    "platform linux -- Python 3.11.4, pytest-7.4.0",
    "rootdir: /home/user/myproject",
    "plugins: anyio-3.6.2, coverage-4.6.0",
    "collecting ... 500 items",
    "",
  ];
  for (let i = 0; i < 497; i++) {
    lines.push(`PASSED tests/test_module.py::test_case_${i} .... 0.001s`);
  }
  lines.push(
    "FAILED tests/test_auth.py::test_login",
    "  AssertionError: assert 200 == 401",
    "  assert response.status_code == expected_status",
    "FAILED tests/test_payment.py::test_charge",
    '  KeyError: "stripe_secret" not found in environment',
    "FAILED tests/test_email.py::test_send",
    "  SMTPException: Connection refused smtp.mailgun.org:587",
    "3 failed, 497 passed in 45.3s"
  );
  return lines;
}

function dockerPayload() {
  const lines = [];
  for (let i = 0; i < 200; i++) {
    const hh = String(Math.floor(i / 60)).padStart(2, "0");
    const mm = String(i % 60).padStart(2, "0");
    lines.push(`2024-01-01T${hh}:${mm}:00 INFO GET / HTTP/1.1 200 OK`);
  }
  lines.push(
    "2024-01-01T03:21:00 ERROR Connection refused to postgres:5432",
    "  at pg.connect (node_modules/pg/lib/client.js:54:12)",
    "  at Server.<anonymous> (server.js:122:5)",
    "2024-01-01T03:21:05 FATAL Service crashed after 3 retries"
  );
  return lines;
}

function cargoPayload() {
  const crates = [
    "serde", "tokio", "reqwest", "hyper", "syn", "quote", "proc-macro2",
    "bytes", "futures", "pin-project", "async-trait", "anyhow", "thiserror",
    "tracing", "tracing-subscriber", "log", "env_logger", "clap", "structopt",
    "config", "toml", "serde_json", "chrono", "uuid", "rand", "hex",
    "base64", "regex", "lazy_static", "once_cell",
  ];
  const lines = crates.map((c) => `   Compiling ${c} v1.0.0`);
  lines.push(
    "warning: unused variable `retries`",
    "  --> src/main.rs:45:9",
    "  |",
    "45|     let retries = 0;",
    "  |         ^^^^^^^ help: if this is intentional, prefix with an underscore: `_retries`",
    "warning: 1 warning emitted",
    "   Finished dev [unoptimized + debuginfo] target(s) in 12.43s"
  );
  return lines;
}

function npmPayload() {
  const lines = ["", "  my-app"];
  for (let i = 0; i < 295; i++) {
    lines.push(`    ✓ should handle case ${i} (${(i % 50) + 1}ms)`);
  }
  lines.push(
    "    ✗ should authenticate user",
    "      Error: expected 200 got 401",
    "      + expected  - actual",
    "      - 401",
    "      + 200",
    "",
    "  295 passing (8s)",
    "  1 failing"
  );
  return lines;
}

// ── Run benchmarks ────────────────────────────────────────────────────

const results = [
  bench("pytest -v  (500 tests, 3 failures)", "pytest -v",         pytestPayload()),
  bench("docker logs (200 healthchecks)",     "docker logs myapp", dockerPayload()),
  bench("cargo build (30 crates)",            "cargo build",       cargoPayload()),
  bench("npm test   (295 passing, 1 failing)","npm test",          npmPayload()),
];

// ── Print table ───────────────────────────────────────────────────────

const W   = 82;
const col  = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const sep  = (ch)   => ch.repeat(W);

console.log("\n🧺 laundryman — honest token cost: today vs with replaceToolOutput");
console.log(sep("━"));
console.log(
  col("Command", 33) +
  rpad("Baseline", 10) +
  rpad("Ctx", 8) +
  rpad("Today", 10) +
  rpad("Future", 10) +
  rpad("Now %", 8) +
  rpad("Later %", 9)
);
console.log(sep("─"));

for (const r of results) {
  const nowStr   = r.nowPct > 0 ? `+${r.nowPct}%` : `${r.nowPct}%`;
  const laterStr = `${r.laterPct}%`;
  console.log(
    col(r.label, 33) +
    rpad(`${r.baseline}`, 10) +
    rpad(`${r.context}`, 8) +
    rpad(`${r.today}`, 10) +
    rpad(`${r.future}`, 10) +
    rpad(nowStr, 8) +
    rpad(laterStr, 9)
  );
}

const totBaseline = results.reduce((s, r) => s + r.baseline, 0);
const totContext  = results.reduce((s, r) => s + r.context,  0);
const totToday    = results.reduce((s, r) => s + r.today,    0);
const totFuture   = results.reduce((s, r) => s + r.future,   0);
const totNowPct   = Math.round(((totBaseline - totToday)  / totBaseline) * 100);
const totLatePct  = Math.round(((totBaseline - totFuture) / totBaseline) * 100);

console.log(sep("─"));
console.log(
  col("TOTAL", 33) +
  rpad(`${totBaseline}`, 10) +
  rpad(`${totContext}`, 8) +
  rpad(`${totToday}`, 10) +
  rpad(`${totFuture}`, 10) +
  rpad(`${totNowPct}%`, 8) +
  rpad(`${totLatePct}%`, 9) +
  "  <- real saving"
);
console.log(sep("━"));

console.log(`
Column meanings:
  Baseline = tokens WITHOUT laundryman (what Claude would process with no hook)
  Ctx      = tokens in the filtered additionalContext that laundryman injects
  Today    = Baseline + Ctx  ← additionalContext is ADDITIVE, not replacing
  Future   = Ctx only        ← when replaceToolOutput ships, original is suppressed
  Now %    = (Baseline − Today) / Baseline  — negative means MORE tokens today, not fewer
  Later %  = (Baseline − Future) / Baseline — the real saving once the API ships

Real saving today: essentially zero (or slightly negative due to additionalContext overhead).
Real saving with replaceToolOutput: ${totLatePct}% fewer tokens across these four scenarios.

Estimate: chars / 4 ≈ tokens  (standard approximation)
Track replaceToolOutput: github.com/anthropics/claude-code/issues/53330
`);
