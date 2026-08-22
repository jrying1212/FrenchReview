# Spec: AI Lesson Structuring

Module ID: `lesson-structuring`

Status: Approved on 2026-08-22
Depends on: `lesson-core`, `pdf-import`.

## Objective

Convert extracted source text into a validated, French-first A1 lesson review while
preserving source fidelity. Provider-specific code, prompts, and failures remain
behind a server-only interface so the rest of the app consumes one stable contract.

## User stories and acceptance behavior

- A learner with `importStatus=ready` can request lesson generation.
- The UI displays processing state and prevents concurrent requests for that lesson.
- Successful output supplies summary, vocabulary, sentences, grammar,
  pronunciation focus, and key points; an empty category is allowed when absent.
- French source sentences are preserved. Additional examples are permitted only
  when `sourceKind=additional_example` makes them visibly distinguishable.
- Explanations and translations use English appropriate for CEFR A1.
- Every noun has `gender=masculine|feminine|unknown`; non-nouns have `gender=null`.
- Definite/indefinite articles may be null only when not applicable or unreliable.
- Invalid provider JSON is never persisted. One automatic repair attempt may be made
  using validation errors; subsequent failure becomes `INVALID_AI_OUTPUT`.
- Provider timeout, authentication, quota/rate limit, and generic upstream failures
  map to stable safe error codes and allow manual retry.
- A retry preserves the last valid structured lesson until replacement succeeds.

## Tech stack and commands

Use a server-only `LessonStructurer` interface, a provider adapter selected through
environment configuration, Zod runtime schemas, and the provider's supported
structured-output mechanism where available. No provider SDK may be imported by UI
or domain consumers.

```text
npm test -- lesson-structuring
npm run test:e2e -- lesson-structuring
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
app/api/lessons/[id]/structure/route.ts  Generate/retry boundary
components/ai/generation-status.tsx       Progress and recovery UI
lib/contracts/structured-lesson.ts       Canonical runtime schema
lib/ai/lesson-structurer.ts               Provider-neutral interface
lib/ai/providers/                         Selected provider adapter
lib/ai/prompts/structure-lesson.ts        Versioned prompt builder
lib/ai/structure-lesson.ts                Orchestration and persistence
tests/lesson-structuring/                  Contract/orchestration tests
e2e/lesson-structuring.spec.ts             Stubbed-provider flow
```

## Structured lesson contract

All arrays default to empty arrays; unknown fields are rejected. Each generated item
has a stable UUID assigned by the application after validation, not by the model.

```text
StructuredLesson
- schemaVersion: 1
- title: string (1..120)
- summary: string (1..800)
- vocabulary: VocabularyItem[] (max 150)
- sentences: SentenceItem[] (max 100)
- grammar: GrammarItem[] (max 30)
- pronunciationFocus: PronunciationItem[] (max 50)
- keyPoints: string[] (max 20, each max 300 chars)

VocabularyItem
- id: UUID
- french: string
- meaningEn: string
- partOfSpeech: noun|verb|adjective|adverb|pronoun|preposition|conjunction|expression|other
- gender: masculine|feminine|unknown|null
- definiteArticle: le|la|l'|les|null
- indefiniteArticle: un|une|des|null
- displayForm: string
- exampleFrench: string|null
- exampleMeaningEn: string|null
- sourceKind: source|additional_example

SentenceItem
- id: UUID
- french: string
- meaningEn: string
- noteEn: string|null
- sourceKind: source|additional_example

GrammarItem
- id: UUID
- topic: string
- explanationEn: string
- examples: { french: string, meaningEn: string|null, sourceKind: source|additional_example }[]

PronunciationItem
- id: UUID
- text: string
- noteEn: string
- sourceKind: source|additional_example
```

The schema enforces the noun/non-noun gender invariant. `unknown` means the item is
known to be a noun but gender cannot be established reliably. The prompt forbids
gender inference from English and instructs the model to omit uncertain articles.

`POST /api/lessons/{id}/structure` takes no lesson text from the client. It reads the
persisted `rawText`, records a prompt version and model identifier, validates the
response, assigns item IDs, and atomically replaces `parsedContent`.

Provider lesson content must not appear in logs. Permitted diagnostics are request
ID, lesson ID, prompt version, model identifier, duration, token counts when
available, result code, and schema-error paths without rejected values.

## Code style

Separate prompt construction, provider transport, schema validation, ID assignment,
and persistence. Dependencies are injected for deterministic testing.

```ts
export interface LessonStructurer {
  structure(input: StructureLessonInput): Promise<UnknownProviderOutput>;
}
```

## Testing strategy

- Unit: schema limits/invariants, prompt rules, error mapping, ID assignment, and
  single repair-attempt behavior.
- Golden contract cases: nouns, non-nouns, elision, plural articles, unknown gender,
  empty categories, additional examples, and preserved French diacritics.
- Integration: mocked provider success, malformed JSON, invalid semantics, timeout,
  rate limit, authentication error, retry, and atomic replacement.
- E2E: generate and retry through a deterministic local fake; no paid live API in CI.
- Manual acceptance: one real teacher PDF with a configured provider, reviewed by the
  learner for omissions and inventions before the module is accepted.

## Boundaries

- Always: keep API keys server-only, validate all output, label added examples,
  preserve last valid data on failure, and record schema/prompt versions.
- Ask first: choose or change provider/model, transmit lesson data externally,
  change the canonical schema, add prompt caching, or raise output limits.
- Never: persist invalid output, send a client-supplied arbitrary prompt, log lesson
  content/provider payloads, guess uncertain noun gender, or silently add facts.

## Success criteria

- Every contract invariant is enforced at runtime and covered by tests.
- A deterministic fake produces a complete lesson that survives refresh.
- All upstream failure classes yield safe, retryable UI states without destroying
  the last valid output.
- Manual comparison against one real PDF finds no unlabeled invented content and
  confirms noun gender/article treatment is useful for A1 review.
- Module verification commands pass.

## Open questions

- Blocking before implementation: select the LLM provider/model and approve sending
  extracted lesson text to that provider. The adapter design must remain unchanged
  by that selection.
