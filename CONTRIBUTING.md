# Contributing to laundryman 🧺

## Requirements / Requisitos

| Tool | Minimum | Recommended | Check |
|------|---------|-------------|-------|
| **Node.js** | v16.0.0 | v20+ (LTS) | `node --version` |
| **npm** | v7.0.0 | v10+ | `npm --version` |
| **git** | any | latest | `git --version` |

> **Why Node 16?** `readline` async iterator (`for await`) was stabilized in Node 16.
> The hook uses zero external dependencies — only Node.js built-ins.

### Install Node.js

**macOS**
```bash
# via Homebrew (recommended)
brew install node

# or via nvm (recommended for devs)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
nvm use --lts
```

**Windows**
```powershell
# via winget
winget install OpenJS.NodeJS.LTS

# or download the installer at:
# https://nodejs.org/en/download
```

**Linux (Ubuntu/Debian)**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## Setup / Configuração

```bash
# 1. Clone the repo
git clone https://github.com/dhiego-coelho/laundryman
cd laundryman

# 2. No npm install needed — zero dependencies!
# Just verify Node is available:
node --version   # must be >= 16
```

---

## Running the hook locally / Rodando o hook localmente

The hook is a plain Node.js script that reads JSON from stdin and writes JSON to stdout.
You can test it directly without installing it into Claude Code:

```bash
# Simulate a pytest run with 500 tests
echo '{
  "tool_name": "Bash",
  "tool_input": { "command": "pytest -v" },
  "tool_response": {
    "output": "platform linux -- Python 3.11\nrootdir: /home/user\nplugins: anyio\nPASSED tests/test_foo.py::test_a ... 0.001s\nPASSED tests/test_foo.py::test_b ... 0.001s\nFAILED tests/test_auth.py::test_login - AssertionError: 200 != 401\n1 failed, 2 passed in 1.2s"
  }
}' | node hooks/laundryman.js

# Expected output:
# {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"[🧺 laundryman] 7 lines → 3 lines (57% washed)\nFAILED tests/test_auth.py::test_login - AssertionError: 200 != 401\n1 failed, 2 passed in 1.2s"}}
```

---

## Installing into Claude Code / Instalando no Claude Code

```bash
# macOS / Linux / WSL
bash install.sh

# Windows (PowerShell)
.\install.ps1

# Verify — check that the hook was registered:
cat ~/.claude/settings.json
# Should contain a PostToolUse entry pointing to laundryman.js
```

---

## Project structure / Estrutura do projeto

```
laundryman/
├── assets/
│   └── laundryman.png        # mascot — pixel art character
├── hooks/
│   └── laundryman.js         # THE HOOK — this is the product
├── index.html                # landing page (GitHub Pages)
├── install.sh                # installer for macOS/Linux/WSL
├── install.ps1               # installer for Windows PowerShell
├── SKILL.md                  # npx skills add compatibility
├── README.md                 # bilingual docs (EN + PT)
├── CONTRIBUTING.md           # this file
├── package.json              # npm metadata
└── LICENSE                   # MIT
```

---

## Adding a new filter / Adicionando um novo filtro

All filters live in `hooks/laundryman.js`. The pattern is:

**1. Write the filter function**

```js
/**
 * gradle build / gradle test
 * Removes: "Task :compileJava", "> Configure project", download lines
 * Keeps:   FAILED, BUILD FAILED, errors, test results
 */
function filterGradle(output) {
  return output
    .split("\n")
    .filter((line) => {
      if (/^> Task :.+UP-TO-DATE/.test(line))   return false;
      if (/^> Configure project/.test(line))     return false;
      if (/^Download /.test(line))               return false;
      if (/^> Task :\w+compile/.test(line))      return false;
      return true;
    })
    .join("\n");
}
```

**2. Register it in the router**

```js
function detectAndFilter(command, output) {
  // ... existing entries ...
  if (/gradle/.test(cmd)) return filterGradle(output);  // ← add here
  return filterGeneric(output);
}
```

**3. Add a benchmark to README.md**

Run it against real output and measure before/after line counts:

```bash
echo '{ "tool_name": "Bash", "tool_input": { "command": "gradle build" }, "tool_response": { "output": "YOUR_REAL_OUTPUT_HERE" } }' \
  | node hooks/laundryman.js
```

**4. Open a PR** with the filter, the benchmark number, and a short description.

---

## Uninstall / Desinstalar

```bash
# macOS / Linux
bash install.sh --uninstall

# Windows
.\install.ps1 -Uninstall
```

---

## Roadmap context

The hook currently uses `additionalContext` because Claude Code's `PostToolUse`
does not yet support full output replacement.

When Anthropic ships `replaceToolOutput`
([issue #53330](https://github.com/anthropics/claude-code/issues/53330)),
we'll switch to true replacement — meaning the original noisy output won't
reach Claude at all. That's where the hook will deliver its full potential.

---

## License

MIT. Wash freely.
