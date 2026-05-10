#!/usr/bin/env node
// Automated test suite for laundryman filters.
// Run with: node tests/run.js

const { filterPytest, filterNpmTest, filterCargo, filterDocker, filterGeneric, detectAndFilter } =
  require("../hooks/laundryman");

let passed = 0;
let failed = 0;

function check(condition, label, detail) {
  if (condition) {
    console.log(`  PASS ${label}`);
    passed++;
  } else {
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

const has  = (str, sub) => str.includes(sub);
const lacks = (str, sub) => !str.includes(sub);

// ── pytest — 20+ PASSED lines + 1 FAILED ────────────────────────────

console.log("\n[pytest]");

const pytestLines = [
  "platform linux -- Python 3.11.4, pytest-7.4.0",
  "rootdir: /home/user/myproject",
  "plugins: anyio-3.6.2",
  "collecting ... 500 items",
  "",
];
for (let i = 0; i < 22; i++) {
  pytestLines.push(`PASSED tests/test_models.py::test_case_${i} .... 0.001s`);
}
pytestLines.push(
  "FAILED tests/test_auth.py::test_login",
  "  AssertionError: assert 200 == 401",
  "1 failed, 22 passed in 3.1s"
);
const pytestOutput   = pytestLines.join("\n");
const pytestFiltered = filterPytest(pytestOutput);

check(lacks(pytestFiltered, "PASSED"),          "removes all 22 PASSED lines",      'output still contains "PASSED"');
check(lacks(pytestFiltered, "platform linux"),  "removes platform info",             'output still contains "platform"');
check(lacks(pytestFiltered, "rootdir:"),        "removes rootdir line",              'output still contains "rootdir:"');
check(lacks(pytestFiltered, "plugins:"),        "removes plugins line",              'output still contains "plugins:"');
check(lacks(pytestFiltered, "collecting"),      "removes collecting line",           'output still contains "collecting"');
check(has(pytestFiltered,   "FAILED"),          "keeps the FAILED line",             'output is missing "FAILED"');
check(has(pytestFiltered,   "AssertionError"),  "keeps the traceback",               'output is missing "AssertionError"');
check(has(pytestFiltered,   "1 failed"),        "keeps the summary",                 'output is missing summary line');

// ── npm test — ✓ and ✗ mixed ────────────────────────────────────────

console.log("\n[npm test]");

const npmOutput = [
  "  my-app",
  "    ✓ should create user (12ms)",
  "    ✓ should list users (8ms)",
  "    ✓ should update user (15ms)",
  "    ✓ should get profile (9ms)",
  "    ✗ should delete user",
  "      Error: expected 200 got 404",
  "      + expected  - actual",
  "      - 404",
  "      + 200",
  "    ✗ should authenticate",
  "      Error: JWT secret missing",
  "  5 passing (1s)",
  "  2 failing",
].join("\n");

const npmFiltered = filterNpmTest(npmOutput);

check(lacks(npmFiltered, "✓ should create"),  "removes ✓ passing tests",           'output still contains passing tests');
check(lacks(npmFiltered, "✓ should list"),    "removes all ✓ passing tests",        'output still contains "✓ should list"');
check(has(npmFiltered,   "✗ should delete"),  "keeps ✗ failing test",               'output is missing "✗ should delete"');
check(has(npmFiltered,   "✗ should authen"),  "keeps second ✗ failing test",        'output is missing "✗ should authenticate"');
check(has(npmFiltered,   "Error:"),           "keeps error messages",               'output is missing "Error:"');
check(has(npmFiltered,   "5 passing"),        "keeps passing count in summary",     'output is missing "5 passing"');
check(has(npmFiltered,   "2 failing"),        "keeps failing count in summary",     'output is missing "2 failing"');

// ── cargo build — Compiling lines + warning ──────────────────────────

console.log("\n[cargo build]");

const cargoOutput = [
  "   Compiling serde v1.0.0 (/home/user/.cargo/registry/src)",
  "   Compiling tokio v1.35.0 (/home/user/.cargo/registry/src)",
  "   Compiling myproject v0.1.0 (/home/user/myproject)",
  "   Downloaded regex v1.9.0",
  "   Updating crates.io index",
  "warning: unused variable `retries`",
  "  --> src/main.rs:45:9",
  "  |",
  "45|     let retries = 0;",
  "  |         ^^^^^^^ help: prefix with `_` to suppress",
  "warning: 1 warning emitted",
  "   Finished dev [unoptimized + debuginfo] target(s) in 12.43s",
].join("\n");

const cargoFiltered = filterCargo(cargoOutput);

check(lacks(cargoFiltered, "Compiling"),     "removes Compiling lines",           'output still contains "Compiling"');
check(lacks(cargoFiltered, "Downloaded"),    "removes Downloaded lines",          'output still contains "Downloaded"');
check(lacks(cargoFiltered, "Updating"),      "removes Updating lines",            'output still contains "Updating"');
check(lacks(cargoFiltered, "Finished dev"),  "removes Finished dev line",         'output still contains "Finished dev"');
check(has(cargoFiltered,   "warning:"),      "keeps warning message",             'output is missing "warning:"');
check(has(cargoFiltered,   "src/main.rs"),   "keeps source location",             'output is missing source location');

// ── docker logs — INFO healthcheck + ERROR ───────────────────────────

console.log("\n[docker logs]");

const dockerOutput = [
  "2024-01-01T10:00:01 INFO GET / HTTP/1.1 200 OK",
  "2024-01-01T10:00:02 INFO GET / HTTP/1.1 200 OK",
  "2024-01-01T10:00:03 INFO GET / HTTP/1.1 200 OK",
  "2024-01-01T10:00:04 INFO Starting background job runner",
  "2024-01-01T10:00:05 INFO Job queue initialized, 0 pending",
  "2024-01-01T10:00:06 ERROR Connection refused to postgres:5432",
  "2024-01-01T10:00:07 WARN Retry attempt 1 of 3",
  "2024-01-01T10:00:08 FATAL Max retries exceeded, shutting down",
].join("\n");

const dockerFiltered = filterDocker(dockerOutput);

check(lacks(dockerFiltered, "GET / HTTP"),        "removes healthcheck access logs",    'output still contains "GET / HTTP"');
check(lacks(dockerFiltered, "Starting background"),"removes INFO-only lines",           'output still contains INFO noise');
check(lacks(dockerFiltered, "Job queue"),          "removes all INFO-only lines",        'output still contains "Job queue"');
check(has(dockerFiltered,   "ERROR"),             "keeps ERROR lines",                  'output is missing "ERROR"');
check(has(dockerFiltered,   "WARN"),              "keeps WARN lines",                   'output is missing "WARN"');
check(has(dockerFiltered,   "FATAL"),             "keeps FATAL lines",                  'output is missing "FATAL"');

// ── git routing — "cd /repo && git status" must use filterGit ────────

console.log("\n[git routing]");

// filterGit does NOT strip ANSI; filterGeneric does.
// If routing is wrong, ANSI codes disappear — observable difference.
const ansiGitOutput = Array(12)
  .fill("\x1b[32mOn branch main\x1b[0m")
  .join("\n");

const rDirect   = detectAndFilter("git status",              ansiGitOutput);
const rPrefixed = detectAndFilter("cd /repo && git status",  ansiGitOutput);
const rChained  = detectAndFilter("cd repo && git pull",     ansiGitOutput);

check(has(rDirect,   "\x1b["), "git status          → filterGit (ANSI preserved)",    "ANSI stripped — wrong filter applied");
check(has(rPrefixed, "\x1b["), "cd /repo && git status → filterGit (ANSI preserved)", "ANSI stripped — wrong filter applied");
check(has(rChained,  "\x1b["), "cd repo && git pull    → filterGit (ANSI preserved)", "ANSI stripped — wrong filter applied");
check(rDirect === rPrefixed,   "same result regardless of command prefix",             "results differ between direct and prefixed");

// ── summary ──────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${total} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
