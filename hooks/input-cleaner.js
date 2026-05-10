#!/usr/bin/env node
// hooks/input-cleaner.js — UserPromptSubmit hook for Claude Code
// Removes greetings and excess punctuation from user prompts.
//
// Stage 2 (LLM compression via Groq) postponed until
// replaceUserMessage is available in Claude Code.
// Without true replacement, sending both original + compressed
// creates contradictory context — worse than doing nothing.
// Track: github.com/anthropics/claude-code/issues/53330

const readline = require("readline");
const path     = require("path");
const fs       = require("fs");

const DICT_PATH = path.join(__dirname, "../dictionary/stopwords.json");

function loadDictionary() {
  try {
    return JSON.parse(fs.readFileSync(DICT_PATH, "utf8"));
  } catch {
    return {};
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPhraseList(dict) {
  const list = [];
  for (const [category, config] of Object.entries(dict)) {
    if (!config.enabled || category === "punctuation") continue;
    for (const [key, terms] of Object.entries(config)) {
      if (!Array.isArray(terms)) continue;
      for (const term of terms) {
        list.push({ phrase: term.toLowerCase(), category });
      }
    }
  }
  // Longer phrases first — prevents "oi" from partially matching before "boa noite"
  return list.sort((a, b) => b.phrase.length - a.phrase.length);
}

function cleanInput(text) {
  const dict    = loadDictionary();
  const phrases = buildPhraseList(dict);

  let result = text;
  const removedMap = {}; // category → matched strings[]

  // Stage 1a: Remove phrases from enabled categories.
  // Boundary: (?<![a-zA-Z0-9À-ÿ]) prevents matching inside words
  // (e.g. "hi" won't match inside "github")
  for (const { phrase, category } of phrases) {
    const pattern = `(?<![a-zA-Z0-9\\u00C0-\\u00FF])${escapeRegex(phrase)}(?![a-zA-Z0-9\\u00C0-\\u00FF])`;
    const regex   = new RegExp(pattern, "gi");
    result = result.replace(regex, (match) => {
      if (!removedMap[category]) removedMap[category] = [];
      removedMap[category].push(match.trim());
      return " ";
    });
  }

  // Stage 1b: Punctuation — always runs regardless of enabled flag.
  result = result
    .replace(/^[\s!?,;:.…]+/, "")  // strip leading punctuation/whitespace
    .replace(/[\s!?,;:.…]+$/, "")  // strip trailing punctuation/whitespace
    .replace(/\s{2,}/g, " ")       // collapse multiple spaces
    .trim();

  // Safety: never return an empty string
  if (!result) return text;

  // Log
  const cats        = Object.keys(removedMap);
  const originalLen = text.length;
  const cleanedLen  = result.length;
  const pct         = Math.round(((originalLen - cleanedLen) / originalLen) * 100);

  if (cats.length > 0 || result !== text) {
    const catStr     = cats.length ? cats.join(", ") : "punctuation";
    const samples    = cats.flatMap((c) => removedMap[c]).map((s) => `'${s}'`).join(", ");
    const sampleStr  = samples ? ` → ${samples}` : "";
    process.stderr.write(
      `[🧺 laundryman input] removed: ${catStr}${sampleStr} (${pct}% reduction)\n`
    );
  }

  return result;
}

module.exports = { cleanInput };

// ── Hook entrypoint ───────────────────────────────────────────────────

async function main() {
  const rl = readline.createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) lines.push(line);

  let payload;
  try {
    payload = JSON.parse(lines.join("\n"));
  } catch {
    process.exit(0);
  }

  const prompt = payload.prompt || "";
  if (!prompt.trim()) process.exit(0);

  const cleaned = cleanInput(prompt);
  if (cleaned === prompt) process.exit(0);

  const result = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: `[🧺 laundryman] Cleaned prompt: ${cleaned}`,
    },
  };

  console.log(JSON.stringify(result));
  process.exit(0);
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}
