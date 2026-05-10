# How `additionalContext` works — and why laundryman has value today

> **tl;dr:** `additionalContext` is injected *before* the original output in Claude's context
> window. Based on observed behavior and LLM attention research, models tend to prioritize
> earlier content — but this is **not guaranteed** and may change with future model versions.
> Today laundryman reduces noise in what it injects; total token savings require `replaceToolOutput`.

---

## The current limitation

Claude Code's `PostToolUse` hook today supports only `additionalContext`:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "...(filtered output)..."
  }
}
```

This means the original tool output **still reaches Claude** — laundryman cannot suppress it
yet. The full context Claude sees looks like this:

```
┌─────────────────────────────────────────────────────────┐
│  Tool result block (as seen by Claude)                  │
│                                                         │
│  [additionalContext — injected FIRST]                   │
│  ─────────────────────────────────────────────────────  │
│  [🧺 laundryman] 518 lines → 17 lines (97% washed)     │
│                                                         │
│  FAILED tests/test_auth.py::test_login                  │
│    AssertionError: assert 200 == 401                    │
│  FAILED tests/test_payment.py::test_charge             │
│    KeyError: "stripe_secret" not found                  │
│  3 failed, 497 passed in 45.3s                          │
│                                                         │
│  [original tool output — appended AFTER]                │
│  ─────────────────────────────────────────────────────  │
│  platform linux -- Python 3.11.4, pytest-7.4.0         │
│  rootdir: /home/user/myproject                          │
│  plugins: anyio-3.6.2                                   │
│  collecting ... 500 items                               │
│  PASSED tests/test_models.py::test_user_0 .... 0.001s  │
│  PASSED tests/test_models.py::test_user_1 .... 0.001s  │
│  ... (495 more PASSED lines) ...                        │
│  FAILED tests/test_auth.py::test_login                  │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Why laundryman still reduces noise in practice

### 1. Position matters — primacy effect in LLMs

Research on LLM context utilization (Liu et al., 2023 — "Lost in the Middle") documents
a **primacy effect**: models tend to recall content at the start or end of a context block
more reliably than content buried in the middle.

`additionalContext` is placed **at the start** of the tool result block. The 495 lines of
`PASSED` output land in the middle and tail — historically the weakest recall position.

> ⚠️ **Caveat:** This argument is based on anecdotal evidence from Claude Code usage and
> findings from research settings that may not transfer directly. Transformer attention
> patterns vary by model version, context length, and task type. Anthropic may change how
> `additionalContext` is positioned or weighted at any time without notice. Treat the
> primacy effect as supporting intuition, **not as a reliability guarantee**.

### 2. Semantic anchoring

When Claude reads the filtered summary first — `3 failed, 497 passed` plus the three
specific failure messages — it forms an interpretation of the tool result *before* reading
the raw output. The subsequent 500 lines of `PASSED` are redundant: they confirm what
the summary already stated.

> ⚠️ **Caveat:** This is observed behavior, not a guaranteed property. A model update
> could change how prior context frames subsequent content. Do not depend on this for
> correctness-critical filtering — laundryman is a best-effort noise reducer, not a
> deterministic information gate.

### 3. Token cost today is not actually reduced

`additionalContext` is **additive** — it is appended to the context *alongside* the
original output, not instead of it. Claude processes `original tokens + filtered tokens`,
which is slightly *more* than without laundryman.

Run `node docs/benchmark.js` to see exact numbers. The "savings" in the additionalContext
column are real in the sense that the injected signal is cleaner — but the total token
bill does not shrink until `replaceToolOutput` ships.

---

## What this means today vs tomorrow

### Today (with `additionalContext`)

- laundryman injects a clean filtered summary **before** the original output
- Claude processes: `original tokens + additionalContext tokens` — slightly **more** than without laundryman
- No measurable token savings — the original is fully present in context
- The clean summary appearing first *may* help Claude anchor its response (anecdotal, not guaranteed)

### Tomorrow (with `replaceToolOutput`)

- laundryman replaces the original output with the filtered version entirely
- Claude processes: `filtered tokens only` — up to **99% fewer tokens** for pytest-heavy sessions
- Token savings become real, measurable, and independent of attention behavior or model version
- The laundryman codebase needs a one-line change to switch: see the comment near `additionalContext` in `hooks/laundryman.js`

```
Today   (additionalContext):  Claude sees  518 lines original  +  17 lines filtered  = 535 lines
Tomorrow (replaceToolOutput):  Claude sees                          17 lines filtered  =  17 lines
```

[Track Anthropic's progress → issue #53330](https://github.com/anthropics/claude-code/issues/53330)
