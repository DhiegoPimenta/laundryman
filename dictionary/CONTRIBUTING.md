# Contributing to stopwords.json

## Structure

Each category has an `enabled` flag and one key per language:

```json
{
  "category_name": {
    "enabled": true,
    "description": "optional — shown in logs and docs",
    "pt": ["phrase one", "phrase two"],
    "en": ["phrase one", "phrase two"]
  }
}
```

## How to add phrases

1. Choose the right category:
   - `greetings` — pure salutations with no semantic content
   - `punctuation` — handled in code, no phrase list here
   - `politeness` — courtesy phrases (**disabled by default** — may carry intent)
   - `fillers` — filler words (**disabled by default** — often context-dependent)

2. Write phrases in **lowercase** — matching is case-insensitive
3. Add to the correct language key

## How to add a new language

Add a new ISO 639-1 key under any category:

```json
"greetings": {
  "enabled": true,
  "pt": ["olá", "oi"],
  "en": ["hello", "hi"],
  "es": ["hola", "buenos días", "buenas tardes"],
  "fr": ["bonjour", "bonsoir", "salut"]
}
```

## Phrase length and priority

The cleaner sorts all phrases by length descending before matching.
Longer phrases are always tried first, which means:

- `"bom dia"` is matched and removed before `"bom"` could be tried (if it existed)
- No risk of partial matches when adding longer alternatives

You do not need to worry about ordering — just add the phrase and the cleaner handles it.

## Categories disabled by default

`politeness` and `fillers` are off by default because individual words like
`"actually"`, `"just"`, `"I think"` carry semantic weight depending on context:

- `"actually, ignore the previous approach"` — "actually" is load-bearing
- `"just refactor the loop"` — "just" is scope-limiting
- `"I think the bug is in auth.js"` — "I think" signals uncertainty, relevant for Claude

Enable them locally by setting `"enabled": true` in stopwords.json, with the
understanding that false positives are possible.
