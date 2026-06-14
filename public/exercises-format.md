# CRAM — generating exercises with AI

This guide describes the file format for CRAM **fill-in-the-blank exercises**. Give it to an
AI (ChatGPT, Claude, Gemini, …) together with your material, and it will produce a file you
can import into a CRAM *exercises* collection.

## How to use

1. Copy this entire file into your AI chat.
2. Add your request, e.g. *"Make 10 German A1 exercises about daily routines using this format."*
3. The AI returns a **YAML** (or **JSON**) file.
4. In CRAM: open your exercises collection → settings → **Import YAML** → paste it → Import.

Both YAML and JSON are accepted by the importer.

---

## Example (B2 — ready to import)

A complete file with one `bank` and one `choice` exercise. Paste it as-is to try the importer,
or use it as a template.

```yaml
- type: bank
  title: "Dependent prepositions"
  sentences:
    - text: "She's exceptionally good ___ negotiating contracts."
      answer: [at]
    - text: "He is solely responsible ___ the marketing budget."
      answer: [for]
    - text: "Several board members objected ___ the proposal."
      answer: [to]
    - text: "I'm slightly concerned ___ the tight deadline."
      answer: [about]
  distractors: [in, with, of]

- type: choice
  title: "Collocations & word choice"
  sentences:
    - text: "The latest figures ___ doubt on the company's strategy."
      answer: [cast]
      distractors: [[threw, put, made]]
    - text: "We made a ___ decision to delay the launch."
      answer: [conscious]
      distractors: [[conscience, sensible, sensitive]]
    - text: "___ hard she tried, she couldn't ___ the deadline."
      answer: [However, meet]
      distractors:
        - [Although, Whatever, Despite]
        - [make, reach, catch]
```

---

## Format

A file is a **list of exercises**. There are two kinds (`type`):

- **`bank`** — all sentences in the exercise share one shuffled word pool; the learner drags
  (or taps) words from the pool into the gaps. Each word is used once.
- **`choice`** — the learner picks the correct word for each gap from an inline dropdown.

### Exercise fields

| field | required | applies to | meaning |
|-------|----------|-----------|---------|
| `type` | yes | both | `"bank"` or `"choice"` |
| `title` | no | both | short label shown above the block |
| `sentences` | yes | both | list of sentences (see below) |
| `distractors` | no | **bank** only | extra words added to the shared pool (so the last gap can't be guessed) |

### Sentence fields

| field | required | applies to | meaning |
|-------|----------|-----------|---------|
| `text` | yes | both | the sentence; write `___` (three underscores) for each gap |
| `answer` | yes | both | list of the correct word for each gap, **in order** |
| `distractors` | no | **choice** only | wrong options **per gap**: `distractors[i]` is the list of wrong words for gap `i` |

### Rules (important)

- The number of items in `answer` **must equal** the number of `___` in `text`.
- **One gap = one independent answer.** Use several `___` in a sentence **only when there is
  real text between the gaps** (e.g. `"She ___ to work ___ bus"` → `[goes, by]`). If a whole
  phrase fills a single slot, use **one** `___` with the phrase as the answer — e.g.
  `"Yesterday ___ to the park."` → `answer: ["we went"]`, **not** two adjacent gaps.
- **choice**: `distractors` is one list per gap, in the same order as `answer`
  (so `distractors` has the same length as `answer`). Each gap's choices are its `answer`
  word plus its wrong words. The correct word is taken from `answer` — don't repeat it in
  `distractors`.
- **bank**: do *not* put `distractors` on a sentence; extra pool words go in the
  exercise-level `distractors`.
- Keep words short (single tokens work best for the gaps).

---

## YAML example

```yaml
- type: bank
  title: "Verb 'to be'"
  sentences:
    - text: "How ___ you?"
      answer: [are]
    - text: "My ___ ___ Vasiliy"
      answer: [name, is]
  distractors: [am, was]

- type: choice
  title: "Articles & prepositions"
  sentences:
    - text: "I saw ___ elephant"            # single gap
      answer: [an]
      distractors: [[a, the, some]]
    - text: "She ___ to work ___ bus"       # two gaps with text between them
      answer: [goes, by]
      distractors:
        - [go, going]                        # wrong options for gap 1
        - [on]                               # wrong options for gap 2
```

## JSON example (same data)

```json
[
  {
    "type": "bank",
    "title": "Verb 'to be'",
    "sentences": [
      { "text": "How ___ you?", "answer": ["are"] },
      { "text": "My ___ ___ Vasiliy", "answer": ["name", "is"] }
    ],
    "distractors": ["am", "was"]
  },
  {
    "type": "choice",
    "title": "Articles & prepositions",
    "sentences": [
      { "text": "I saw ___ elephant", "answer": ["an"], "distractors": [["a", "the", "some"]] },
      { "text": "She ___ to work ___ bus", "answer": ["goes", "by"],
        "distractors": [["go", "going"], ["on"]] }
    ]
  }
]
```

---

## Ready-to-use prompt

> You are generating a **CRAM exercises** file. Follow the format in the document above
> **exactly**. Create **<N>** exercises about **<topic>** for level **<level>**, mixing `bank`
> and `choice` types. Each sentence must use `___` for gaps, and `answer` length must equal
> the number of gaps. Output **only** the YAML (or JSON) — no explanations, no code fences.
