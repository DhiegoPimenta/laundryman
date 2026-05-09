<div align="center">
  <img src="assets/laundryman.png" width="180" alt="Laundryman mascot"/>
  <h1>laundryman</h1>
  <strong>wash the noise, keep the signal</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT"/>
  <img src="https://img.shields.io/badge/Claude_Code-PostToolUse_Hook-4af0c4" alt="Claude Code"/>
  <img src="https://img.shields.io/badge/dependencies-0-green" alt="zero deps"/>
  <br/><br/>
  <a href="https://dhiego-coelho.github.io/laundryman">🌐 Website</a> ·
  <a href="#english">English</a> ·
  <a href="#português">Português</a>
</div>

---

## English

### The problem

Every time Claude Code runs a command, the **entire output** lands in context.

```
pytest -v → 518 lines → 501 PASSED noise → 17 actual failures
→ 8,000 tokens burned. Every. Single. Run.
```

### The solution

```
pytest -v  →  518 lines in  →  17 lines out  (97% washed 🧺)

[🧺 laundryman] 518 lines → 17 lines (97% washed)
FAILED test_auth.py::test_login - AssertionError: expected 200, got 401
FAILED test_payment.py::test_charge - KeyError: 'stripe_secret'
3 failed, 497 passed in 45.3s
```

### Benchmarks

| Command | Before | After | Saved |
|---------|--------|-------|-------|
| `pytest -v` (500 tests) | 518 lines | 17 lines | **97%** |
| `docker logs` (1h) | 17 lines | 3 lines | **82%** |
| `cargo build` (30 crates) | 25 lines | 9 lines | **64%** |
| `npm test` (jest, 300 tests) | 31 lines | 21 lines | **32%** |

### Install

**macOS / Linux / WSL**
```bash
bash <(curl -s https://raw.githubusercontent.com/dhiego-coelho/laundryman/main/install.sh)
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/dhiego-coelho/laundryman/main/install.ps1 | iex
```

**via npx skills (40+ agents)**
```bash
npx skills add dhiego-coelho/laundryman
```

### Uninstall
```bash
bash install.sh --uninstall
```

### Roadmap

- [x] PostToolUse hook — pytest, npm, cargo, docker, git
- [ ] Custom rules via `.laundryman.json`
- [ ] More filters — gradle, make, dotnet, go test
- [ ] `replaceToolOutput` *(waiting on Anthropic — [issue #53330](https://github.com/anthropics/claude-code/issues/53330))*
- [ ] `replaceUserMessage` input compression *(waiting on Anthropic)*

---

## Português

### O problema

Toda vez que o Claude Code roda um comando, o output inteiro vai pro contexto.

```
pytest -v → 518 linhas → 501 linhas de PASSED → 17 falhas reais
→ 8.000 tokens queimados. Em. Cada. Execução.
```

### Instalar

```bash
# macOS / Linux / WSL
bash <(curl -s https://raw.githubusercontent.com/dhiego-coelho/laundryman/main/install.sh)

# Windows
irm https://raw.githubusercontent.com/dhiego-coelho/laundryman/main/install.ps1 | iex

# npx skills
npx skills add dhiego-coelho/laundryman
```

### Contribuindo

PRs bem-vindos! Para adicionar um filtro: adicione `filterSuaFerramenta()` em `hooks/laundryman.js`, atualize o router `detectAndFilter()` e abra o PR.

---

MIT — wash freely. 🧺
