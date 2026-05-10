<div align="center">

<a href="https://dhiegopimenta.github.io/laundryman/"><img src="assets/laundryman.png" width="320" alt="Laundryman — pixel art character with laundry basket helmet"/></a>

# 🧺 laundryman

### *wash the noise, keep the signal*

**Two hooks for Claude Code: filters noisy tool output and strips greetings from user prompts**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D16-brightgreen)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude_Code-PostToolUse%20%2B%20UserPromptSubmit-4af0c4)](https://docs.anthropic.com/claude-code)
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

**The clean 17-line summary arrives first — the 501 PASSED lines follow in the background, down-weighted by position.**

---

## Benchmarks

> Measured against real tool output. Not estimates.

| Command | Before | After | Noise injected into context |
|---------|--------|-------|-----------------------------|
| `pytest -v` — 500 tests, 3 failures | 518 lines | 17 lines | **up to 97% less noise injected into context** |
| `docker logs` — 1h of mixed logs | 17 lines | 3 lines | **82% less** |
| `cargo build` — 30 crates | 25 lines | 9 lines | **64% less** |
| `npm test` — jest, 300 tests | 31 lines | 21 lines | **32% less** |

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

`input-cleaner.js` registers as a second hook on `UserPromptSubmit` and strips greetings before each message:

1. Loads `dictionary/stopwords.json` — extensible, case-insensitive, no hardcoded patterns
2. Matches phrases longest-first (prevents partial matches — `"bom dia"` before `"bom"`)
3. Returns cleaned prompt as `additionalContext`

Categories `politeness` and `fillers` are disabled by default due to semantic risk. See [`dictionary/CONTRIBUTING.md`](dictionary/CONTRIBUTING.md) to add words or new languages.

**Current limitation:** today laundryman uses `additionalContext`, which means the original noisy output still reaches Claude alongside the filtered version. In practice Claude anchors on the clean summary that appears first and treats the original as background. When Anthropic ships `replaceToolOutput`, the original will be suppressed entirely and savings will be total — [tracking issue #53330](https://github.com/anthropics/claude-code/issues/53330).

---

## Two modes

| Mode | How | Today | Future |
|------|-----|-------|--------|
| 🔧 **Hook** (automatic) | PostToolUse fires on every Bash call | `additionalContext` — original still reaches Claude | `replaceToolOutput` ships → true replacement |
| 🚀 **MCP** (opt-in, **best today**) | Claude calls `laundryman:run_tests` / `run_docker_logs` | **True replacement** — filtered output only | Same, already optimal |
| ⚡ **Hook v2** (coming) | Automatic, no instruction needed | — | `updatedBuiltinToolOutput` via [issue #36843](https://github.com/anthropics/claude-code/issues/36843) |

**MCP mode is the highest-value option right now.** When Claude calls an MCP tool, the returned content IS the result — no original noise attached. Setup in [docs/mcp-mode.md](docs/mcp-mode.md).

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
- [x] `UserPromptSubmit` hook — greetings filter with contributable `dictionary/stopwords.json`
- [x] MCP server — `run_tests` (pytest/jest/cargo/go) + `run_docker_logs` with true output replacement
- [ ] Custom rules via `.laundryman.json` — per-project filter config
- [ ] More tool filters — gradle, make, dotnet test, go test, mvn
- [ ] `replaceToolOutput` support *(waiting on Anthropic — [issue #53330](https://github.com/anthropics/claude-code/issues/53330))*
- [ ] `replaceUserMessage` — will unlock true prompt replacement for input-cleaner *(waiting on Anthropic — [issue #53330](https://github.com/anthropics/claude-code/issues/53330))*

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
PASSED tests/test_models.py::test_user_2 ..... 0.002s   ← ruído
... (495 linhas de ruído a mais) ...
FAILED tests/test_auth.py::test_login       ← isso é o que importa
FAILED tests/test_payment.py::test_charge   ← isso é o que importa
FAILED tests/test_email.py::test_send       ← isso é o que importa

→ 518 linhas enviadas pro Claude. 501 eram ruído.
→ ~8.000 tokens queimados. Em. Cada. Execução.
```

10 execuções por hora = **80.000 tokens lendo "PASSED" mil vezes.**

### A solução

O laundryman intercepta o output via hook `PostToolUse` e entrega só o que importa.

```
$ pytest -v   →   518 linhas entram   →   17 saem

[🧺 laundryman] 518 linhas → 17 linhas (97% lavado)

FAILED tests/test_auth.py::test_login
  AssertionError: assert 200 == 401

FAILED tests/test_payment.py::test_charge
  KeyError: "stripe_secret" not found in environment

FAILED tests/test_email.py::test_send
  SMTPException: Connection refused smtp.mailgun.org:587

3 failed, 497 passed in 45.3s
```

Além disso, um segundo hook remove saudações dos prompts antes de chegarem ao modelo.

### Benchmarks

> Medido contra output real de ferramentas. Não são estimativas.

| Comando | Antes | Depois | Redução de ruído no contexto |
|---------|-------|--------|------------------------------|
| `pytest -v` — 500 testes, 3 falhas | 518 linhas | 17 linhas | **até 97% menos ruído** |
| `docker logs` — 1h de logs mistos | 17 linhas | 3 linhas | **82% menos** |
| `cargo build` — 30 crates | 25 linhas | 9 linhas | **64% menos** |
| `npm test` — jest, 300 testes | 31 linhas | 21 linhas | **32% menos** |

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

### Como funciona

O laundryman registra dois hooks em `~/.claude/settings.json`:

**Hook 1 — PostToolUse** (`hooks/laundryman.js`): após cada comando Bash, lê o output, detecta o tipo de comando (pytest / npm / cargo / docker / git / genérico), aplica filtros direcionados e devolve o output comprimido como `additionalContext`.

**Hook 2 — UserPromptSubmit** (`hooks/input-cleaner.js`): antes de cada mensagem, carrega `dictionary/stopwords.json`, remove saudações e frases de preenchimento usando matching longest-first, e devolve o prompt limpo.

**Servidor MCP** (`mcp/laundryman-mcp.js`): quando o Claude chama uma ferramenta MCP, o conteúdo retornado É o resultado — sem output original junto. Isso dá substituição real hoje, sem esperar pela Anthropic. Configure em [`docs/mcp-mode.md`](docs/mcp-mode.md).

### Dois modos

| Modo | Como | Hoje | Futuro |
|------|------|------|--------|
| 🔧 **Hook** (automático) | PostToolUse em todo Bash | `additionalContext` — original ainda chega junto | `replaceToolOutput` → substituição real |
| 🚀 **MCP** (opt-in, **melhor hoje**) | Claude chama `laundryman:run_tests` | **Substituição real — funciona agora** | Igual, já ótimo |
| ⚡ **Hook v2** (em breve) | Automático, sem instrução | — | `updatedBuiltinToolOutput` |

**O modo MCP é a opção de maior valor hoje.** Quando o Claude chama uma ferramenta MCP, o conteúdo retornado É o resultado — sem ruído original junto. Veja [docs/mcp-mode.md](docs/mcp-mode.md).

### O que é lavado

| Ferramenta | Ruído removido | Sinal mantido |
|-----------|---------------|---------------|
| `pytest` | Linhas PASSED, pontos, info de plataforma, rootdir, plugins | FAILED, ERROR, tracebacks, resumo |
| `npm test` / jest | ✓ testes passando, timing por teste | ✗ falhas, console.error, resumo |
| `cargo build` | Compiling X, Downloaded, Updating | warnings, errors |
| `docker logs` | INFO healthchecks, access logs | ERROR, WARN, FATAL |
| `git` | Clusters de linhas em branco | tudo o mais |
| outros | Códigos ANSI, clusters em branco | todo o conteúdo |

### Roadmap

- [x] Hook `PostToolUse` — pytest, npm, cargo, docker, git
- [x] Hook `UserPromptSubmit` — filtro de saudações com `dictionary/stopwords.json` contributável
- [x] Servidor MCP — `run_tests` + `run_docker_logs` com substituição real de output
- [ ] Regras customizadas via `.laundryman.json` — config de filtros por projeto
- [ ] Mais filtros de ferramentas — gradle, make, dotnet test, go test, mvn
- [ ] Suporte a `replaceToolOutput` *(aguardando Anthropic — [issue #53330](https://github.com/anthropics/claude-code/issues/53330))*

### Contribuindo

PRs bem-vindos! Para adicionar um filtro novo, veja o [CONTRIBUTING.md](CONTRIBUTING.md). Para adicionar palavras ao dicionário, veja [`dictionary/CONTRIBUTING.md`](dictionary/CONTRIBUTING.md).

</details>

---

<div align="center">
  <sub>MIT License · Built for the Claude Code ecosystem · PRs welcome</sub><br/>
  <sub>🧺 wash the noise · keep the signal · save the tokens</sub><br/>
  <sub><a href="https://dhiegopimenta.github.io/laundryman/">dhiegopimenta.github.io/laundryman</a></sub>
</div>