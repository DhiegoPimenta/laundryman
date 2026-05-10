<div align="center">

<a href="https://dhiegopimenta.github.io/laundryman/"><img src="assets/laundryman.png" width="320" alt="Laundryman — pixel art character with laundry basket helmet"/></a>

# 🧺 laundryman

### *wash the noise, keep the signal*

**MCP server + PostToolUse hook for Claude Code: filters noisy tool output and strips greetings from user prompts**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D16-brightgreen)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude_Code-MCP%20%2B%20PostToolUse-4af0c4)](https://docs.anthropic.com/claude-code)
[![1 dep](https://img.shields.io/badge/dependencies-1%20(MCP%20SDK)-blue)](package.json)

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

laundryman gives you two modes. **MCP mode is the best option today.**

---

## Two modes

| Mode | How | Today | Future |
|------|-----|-------|--------|
| 🚀 **MCP** (best today) | Claude calls `laundryman:run_tests` | ✅ **True replacement — filtered output only** | Same, already optimal |
| 🔧 **Hook** (automatic) | PostToolUse fires on every Bash call | ⚠️ Additive — original still reaches Claude | ✅ True + automatic when `replaceToolOutput` ships |
| ⚡ **Hook v2** (coming) | Automatic, no instruction needed | — | ✅ True + automatic via [issue #36843](https://github.com/anthropics/claude-code/issues/36843) |

---

## 🚀 MCP mode — true replacement today

When Claude calls an MCP tool, the returned content **is** the result — no original output attached. This is the only mode that genuinely reduces context today.

```
Hook mode today:   original 518 lines  +  17 lines filtered  =  535 lines to Claude
MCP mode today:    17 lines filtered only                     =  17 lines to Claude
```

Install registers the MCP server automatically. Add this to your project's `CLAUDE.md` to activate:

```markdown
## Tool preferences (laundryman)

When running any test suite, always use `laundryman:run_tests` instead of Bash directly.
Example: `laundryman:run_tests(path=".", runner="pytest")`

When checking container logs, always use `laundryman:run_docker_logs` instead of Bash directly.
Example: `laundryman:run_docker_logs(container="myapp")`

These tools return pre-filtered output — errors and warnings only, no noise.
Do not run pytest / jest / cargo test / docker logs directly via Bash.
```

> The install script offers to create this CLAUDE.md file automatically.

Full MCP reference and manual setup: [docs/mcp-mode.md](docs/mcp-mode.md)

---

## 🔧 Hook mode — automatic, additive today

> ⚠️ **Honest caveat:** the PostToolUse hook uses `additionalContext`, which is **additive** — the original noisy output still reaches Claude alongside the filtered version. Hook mode does not reduce context size today. It registers automatically and will give true replacement without any changes when Anthropic ships `replaceToolOutput` ([issue #36843](https://github.com/anthropics/claude-code/issues/36843)).

Worth keeping installed — it costs nothing and activates fully when `replaceToolOutput` ships.

---

## Benchmarks

> Measured against real tool output. Not estimates. Numbers reflect MCP mode (true replacement) — hook mode adds these lines on top of the original today.

| Command | Before | After | Noise removed |
|---------|--------|-------|---------------|
| `pytest -v` — 500 tests, 3 failures | 518 lines | 17 lines | **97%** |
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

> Requires Node.js ≥ 16. The install script prompts to create a `CLAUDE.md` template with MCP instructions.

---

## How it works

### MCP server (`mcp/laundryman-mcp.js`)

Registered automatically in `~/.claude/settings.json` under `mcpServers`. Claude calls it explicitly via your `CLAUDE.md` instructions.

**Tools:**

| Tool | Args | Description |
|------|------|-------------|
| `run_tests` | `path` (required), `runner` (optional) | Runs pytest/jest/cargo/go test. Auto-detects runner. Returns failures only. |
| `run_docker_logs` | `container` (required), `tail` (optional, default 100) | Fetches container logs. Returns ERROR/WARN/FATAL only. |

### PostToolUse hook (`hooks/laundryman.js`)

Registered automatically in `~/.claude/settings.json` under `hooks.PostToolUse`. Fires on every Bash call — no instruction needed. Today uses `additionalContext` (additive). Becomes true replacement when `replaceToolOutput` ships.

**What gets filtered:**

| Tool | Noise removed | Signal kept |
|------|--------------|-------------|
| `pytest` | PASSED lines, dots, platform info, rootdir, plugins | FAILED, ERROR, tracebacks, summary |
| `npm test` / jest | ✓ passing tests, per-test timing | ✗ failures, console.error, summary |
| `cargo build` | Compiling X, Downloaded, Updating | warnings, errors |
| `docker logs` | INFO health checks, access logs | ERROR, WARN, FATAL |
| `git` | blank line clusters | everything else |
| any other | ANSI codes, blank clusters | all content |

### UserPromptSubmit hook (`hooks/input-cleaner.js`) — opt-in, not installed by default

Strips greetings from prompts using `dictionary/stopwords.json`. To enable manually, add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/input-cleaner.js" }]
    }]
  }
}
```

See [`dictionary/CONTRIBUTING.md`](dictionary/CONTRIBUTING.md) to add words or new languages.

---

## Roadmap

- [x] MCP server — `run_tests` (pytest/jest/cargo/go) + `run_docker_logs` with true output replacement
- [x] `PostToolUse` hook — pytest, npm, cargo, docker, git (automatic, additive today)
- [x] `UserPromptSubmit` hook — greetings filter with contributable `dictionary/stopwords.json` (opt-in)
- [ ] Custom rules via `.laundryman.json` — per-project filter config
- [ ] More tool filters — gradle, make, dotnet test, go test, mvn
- [ ] `replaceToolOutput` support *(waiting on Anthropic — [issue #36843](https://github.com/anthropics/claude-code/issues/36843)) → hook becomes true replacement*
- [ ] `replaceUserMessage` *(waiting on Anthropic) → input-cleaner becomes true replacement*

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, Node.js requirements, how to run the hook locally, and how to add new filters.

PRs welcome — especially new tool filters! Open an issue to request your stack.

---

## Português

<details>
<summary>Clique para expandir 🇧🇷</summary>

### O problema

Toda vez que o Claude Code roda um comando, o **output inteiro** vai pro contexto — incluindo milhares de linhas que você não precisa.

```
$ pytest -v

platform linux -- Python 3.11.4, pytest-7.4.0
rootdir: /home/user/myprojeto
collecting ... 500 items

PASSED tests/test_models.py::test_user_0 ..... 0.001s   ← ruído
PASSED tests/test_models.py::test_user_1 ..... 0.001s   ← ruído
... (495 linhas de ruído a mais) ...
FAILED tests/test_auth.py::test_login       ← isso é o que importa
FAILED tests/test_payment.py::test_charge   ← isso é o que importa

→ 518 linhas enviadas pro Claude. 501 eram ruído.
→ ~8.000 tokens queimados. Em. Cada. Execução.
```

10 execuções por hora = **80.000 tokens lendo "PASSED" mil vezes.**

### A solução — dois modos

| Modo | Como | Hoje | Futuro |
|------|------|------|--------|
| 🚀 **MCP** (melhor hoje) | Claude chama `laundryman:run_tests` | ✅ **Substituição real — só o filtrado chega** | Igual, já ótimo |
| 🔧 **Hook** (automático) | PostToolUse em todo Bash | ⚠️ Aditivo — original ainda chega junto | ✅ Substituição real quando `replaceToolOutput` sair |
| ⚡ **Hook v2** (em breve) | Automático, sem instrução | — | ✅ Real + automático |

### 🚀 Modo MCP — substituição real hoje

Quando o Claude chama uma ferramenta MCP, o conteúdo retornado **é** o resultado — sem output original junto.

```
Hook hoje:   518 linhas originais + 17 filtradas = 535 linhas pro Claude
MCP hoje:    17 linhas filtradas apenas           = 17 linhas pro Claude
```

O install registra o servidor MCP automaticamente. Adicione ao `CLAUDE.md` do projeto:

```markdown
## Tool preferences (laundryman)

When running any test suite, always use `laundryman:run_tests` instead of Bash directly.
When checking container logs, always use `laundryman:run_docker_logs` instead of Bash directly.
Do not run pytest / jest / cargo test / docker logs directly via Bash.
```

### 🔧 Modo Hook — automático, aditivo hoje

> ⚠️ **Aviso honesto:** o hook PostToolUse usa `additionalContext`, que é **aditivo** — o output original ainda chega pro Claude junto com o filtrado. Não reduz o contexto hoje. Se tornará substituição real automaticamente quando a Anthropic lançar `replaceToolOutput` ([issue #36843](https://github.com/anthropics/claude-code/issues/36843)).

### Benchmarks

> Medido contra output real. Não são estimativas. Números refletem o modo MCP.

| Comando | Antes | Depois | Ruído removido |
|---------|-------|--------|----------------|
| `pytest -v` — 500 testes, 3 falhas | 518 linhas | 17 linhas | **97%** |
| `docker logs` — 1h de logs mistos | 17 linhas | 3 linhas | **82%** |
| `cargo build` — 30 crates | 25 linhas | 9 linhas | **64%** |
| `npm test` — jest, 300 testes | 31 linhas | 21 linhas | **32%** |

### Instalar

**macOS / Linux / WSL:**
```bash
bash <(curl -s https://raw.githubusercontent.com/dhiegopimenta/laundryman/main/install.sh)
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/dhiegopimenta/laundryman/main/install.ps1 | iex
```

**via npx skills:**
```bash
npx skills add dhiegopimenta/laundryman
```

**Manual:**
```bash
git clone https://github.com/dhiegopimenta/laundryman
cd laundryman && bash install.sh
```

**Desinstalar:**
```bash
bash install.sh --uninstall
# Windows: .\install.ps1 -Uninstall
```

### Roadmap

- [x] Servidor MCP — `run_tests` + `run_docker_logs` com substituição real
- [x] Hook `PostToolUse` — pytest, npm, cargo, docker, git (aditivo hoje)
- [x] Hook `UserPromptSubmit` — filtro de saudações (opt-in manual)
- [ ] Regras customizadas via `.laundryman.json`
- [ ] Mais filtros — gradle, make, dotnet test, go test, mvn
- [ ] `replaceToolOutput` *(aguardando Anthropic — [issue #36843](https://github.com/anthropics/claude-code/issues/36843))*

### Contribuindo

PRs bem-vindos! Para adicionar um filtro novo, veja o [CONTRIBUTING.md](CONTRIBUTING.md). Para adicionar palavras ao dicionário, veja [`dictionary/CONTRIBUTING.md`](dictionary/CONTRIBUTING.md).

</details>

---

<div align="center">
  <sub>MIT License · Built for the Claude Code ecosystem · PRs welcome</sub><br/>
  <sub>🧺 wash the noise · keep the signal · save the tokens</sub><br/>
  <sub><a href="https://dhiegopimenta.github.io/laundryman/">dhiegopimenta.github.io/laundryman</a></sub>
</div>
