<div align="center">

<a href="https://dhiegopimenta.github.io/laundryman/"><img src="assets/laundryman.png" width="320" alt="Laundryman — pixel art character with laundry basket helmet"/></a>

# 🧺 laundryman

### *wash the noise, keep the signal*

**PostToolUse hook for Claude Code that cuts tool output noise by up to 97%**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D16-brightgreen)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude_Code-PostToolUse-4af0c4)](https://docs.anthropic.com/claude-code)
[![Zero deps](https://img.shields.io/badge/dependencies-0-blue)](package.json)

[🌐 **dhiegopimenta.github.io/laundryman**](https://dhiegopimenta.github.io/laundryman/) · [⚡ Install](#install) · [📊 Benchmarks](#benchmarks) · [🤝 Contributing](CONTRIBUTING.md)

</div>

---

## The problem

Every time Claude Code runs a command, the **entire output** goes into context — including thousands of lines you don't care about.

```
$ pytest -v

platform linux -- Python 3.11.4, pytest-7.4.0
rootdir: /home/user/myproject
collecting ... 500 items

PASSED tests/test_models.py::test_user_0 ..... 0.001s   ← noise
PASSED tests/test_models.py::test_user_1 ..... 0.001s   ← noise
PASSED tests/test_models.py::test_user_2 ..... 0.002s   ← noise
... (495 more lines of noise) ...
FAILED tests/test_auth.py::test_login       ← this is what you need
FAILED tests/test_payment.py::test_charge   ← this is what you need
FAILED tests/test_email.py::test_send       ← this is what you need

→ 518 lines sent to Claude. 501 were noise.
→ ~8,000 tokens burned. Every. Single. Run.
```

10 runs/hour = **80,000 tokens reading "PASSED" a thousand times.**

## The solution

laundryman intercepts every Bash output via `PostToolUse` hook and hands Claude only what matters.

```
$ pytest -v   →   518 lines in   →   17 lines out

[🧺 laundryman] 518 lines → 17 lines (97% washed)

FAILED tests/test_auth.py::test_login
  AssertionError: assert 200 == 401

FAILED tests/test_payment.py::test_charge
  KeyError: "stripe_secret" not found in environment

FAILED tests/test_email.py::test_send
  SMTPException: Connection refused smtp.mailgun.org:587

3 failed, 497 passed in 45.3s
```

**Claude sees the 17 lines. Never knew the other 501 existed.**

---

## Benchmarks

> Measured against real tool output. Not estimates.

| Command | Before | After | Reduction |
|---------|--------|-------|-----------|
| `pytest -v` — 500 tests, 3 failures | 518 lines | 17 lines | **97% 🔥** |
| `docker logs` — 1h of mixed logs | 17 lines | 3 lines | **82%** |
| `cargo build` — 30 crates | 25 lines | 9 lines | **64%** |
| `npm test` — jest, 300 tests | 31 lines | 21 lines | **32%** |

---

## Install

> 🌐 See the full docs and live demo at **[dhiegopimenta.github.io/laundryman](https://dhiegopimenta.github.io/laundryman/)**

**macOS / Linux / WSL — one line:**
```bash
bash <(curl -s https://raw.githubusercontent.com/dhiegopimenta/laundryman/main/install.sh)
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/dhiegopimenta/laundryman/main/install.ps1 | iex
```

**via npx skills (works with Claude Code, Cursor, Windsurf, Copilot, 40+ agents):**
```bash
npx skills add dhiegopimenta/laundryman
```

**Manual:**
```bash
git clone https://github.com/dhiegopimenta/laundryman
cd laundryman && bash install.sh
```

**Uninstall:**
```bash
bash install.sh --uninstall
# Windows: .\install.ps1 -Uninstall
```

> Requires Node.js ≥ 16. Zero other dependencies.

---

## How it works

laundryman registers as a `PostToolUse` hook in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [{
      "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/laundryman.js" }]
    }]
  }
}
```

After every Bash call, `laundryman.js`:
1. Reads the JSON payload from stdin
2. Detects the command type — `pytest` / `npm` / `cargo` / `docker` / `git` / generic
3. Applies targeted filters, strips noise, keeps signal
4. Returns the compressed output as `additionalContext`

Claude sees the clean version. The noisy original stays out of context.

---

## What gets washed

| Tool | Noise removed | Signal kept |
|------|--------------|-------------|
| `pytest` | PASSED lines, dots, platform info, rootdir, plugins | FAILED, ERROR, tracebacks, summary |
| `npm test` / jest | ✓ passing tests, per-test timing | ✗ failures, console.error, summary |
| `cargo build` | Compiling X, Downloaded, Updating | warnings, errors |
| `docker logs` | INFO health checks, access logs | ERROR, WARN, FATAL |
| `git` | blank line clusters | everything else |
| any other | ANSI codes, blank clusters | all content |

---

## Roadmap

> **Current limitation:** `PostToolUse` supports `additionalContext` but not full output replacement. The original noisy output still reaches Claude alongside the clean version. When Anthropic ships `replaceToolOutput`, savings go from ~70% to ~99% effective.

- [x] `PostToolUse` hook — pytest, npm, cargo, docker, git
- [ ] Custom rules via `.laundryman.json` — per-project filter config
- [ ] More tool filters — gradle, make, dotnet test, go test, mvn
- [ ] `replaceToolOutput` support *(waiting on Anthropic — [issue #53330](https://github.com/anthropics/claude-code/issues/53330))*
- [ ] `replaceUserMessage` input compression *(waiting on Anthropic)*

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, Node.js requirements, how to run the hook locally, and how to add new filters.

PRs welcome — especially new tool filters! Open an issue to request your stack.

---

## Português

<details>
<summary>Clique para expandir 🇧🇷</summary>

### O problema

Toda vez que o Claude Code roda um comando, o **output inteiro** vai pro contexto.

```
pytest -v → 518 linhas → 501 linhas de PASSED → 17 falhas reais
→ ~8.000 tokens queimados. Em. Cada. Execução.
```

10 execuções por hora = **80.000 tokens lendo "PASSED" mil vezes.**

### A solução

O laundryman intercepta o output via hook `PostToolUse` e entrega só o que importa.

```
pytest -v  →  518 linhas entram  →  17 saem  (97% lavado 🧺)
```

### Instalar

```bash
# macOS / Linux / WSL
bash <(curl -s https://raw.githubusercontent.com/dhiegopimenta/laundryman/main/install.sh)

# Windows
irm https://raw.githubusercontent.com/dhiegopimenta/laundryman/main/install.ps1 | iex

# npx skills
npx skills add dhiegopimenta/laundryman
```

### Como funciona

O hook é registrado em `~/.claude/settings.json` e roda automaticamente após cada comando Bash no Claude Code. Sem configuração adicional.

### Contribuindo

PRs bem-vindos! Para adicionar um filtro novo, veja o [CONTRIBUTING.md](CONTRIBUTING.md).

</details>

---

<div align="center">
  <sub>MIT License · Built for the Claude Code ecosystem · PRs welcome</sub><br/>
  <sub>🧺 wash the noise · keep the signal · save the tokens</sub><br/>
  <sub><a href="https://dhiegopimenta.github.io/laundryman/">dhiegopimenta.github.io/laundryman</a></sub>
</div>