# Spec: AI Lesson Structuring

Module ID: `lesson-structuring`

Status: Amendment approved on 2026-08-22
Depends on: `lesson-core`, `pdf-import`.

## Objective

Convert extracted source text into a validated, French-first A1 lesson review while
preserving source fidelity. Provider-specific code, prompts, and failures remain
behind a server-only interface so the rest of the app consumes one stable contract.

## User stories and acceptance behavior

- A learner with `importStatus=ready` can request lesson generation.
- Before a live provider is approved, the learner can exercise the complete saved
  lesson flow with a deterministic fake. The UI clearly identifies this as demo
  content that was not derived from the uploaded lesson.
- The learner can choose a no-API manual flow: copy the versioned prompt and JSON
  Schema, run them in an AI tool they already use, and paste the returned JSON into
  the application for validation and storage.
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

Use a server-only `LessonStructurer` interface, Zod runtime schemas, and a
deterministic fake as the initial provider. The manual import path bypasses provider
transport but reuses the same schema validation, application ID assignment, and
atomic persistence boundary. A live adapter may later be selected through
environment configuration and use the provider's supported structured-output
mechanism. No provider SDK may be imported by UI or domain consumers.

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
app/api/lessons/[id]/structured-content/route.ts  Manual JSON import boundary
components/ai/generation-status.tsx       Progress and recovery UI
components/ai/manual-lesson-import.tsx     Copy/paste no-API workflow
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
gender inference from English and instructs the model to set uncertain articles to
`null`.

`POST /api/lessons/{id}/structure` takes no lesson text from the client. It reads the
persisted `rawText`, records a prompt version and model identifier, validates the
response, assigns item IDs, and atomically replaces `parsedContent`.

Until a live provider passes its decision gate, this route uses the deterministic
fake and the UI labels its result as demo content. Fake output must exercise the same
validation and persistence path as a future live adapter. It must never be presented
as an analysis of the uploaded PDF.

The manual workflow exposes the versioned prompt and JSON Schema for copying but
never sends them externally. `PUT /api/lessons/{id}/structured-content` accepts a
client-supplied unknown JSON value, validates it as a provider draft, assigns fresh
application UUIDs, and atomically replaces `parsedContent`. Invalid JSON or invalid
semantics return a safe validation error and preserve the last valid lesson. The
application never accepts IDs supplied through this boundary.

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
  rate limit, retry, and atomic replacement. Authentication and generic upstream
  failures are added when a live adapter is approved.
- E2E: generate and retry through a deterministic local fake; no paid live API in CI.
- E2E: copy the manual prompt, reject malformed/invalid pasted JSON, accept a valid
  draft, persist it, and retain the prior valid lesson after a failed replacement.
- Manual acceptance: one real teacher PDF completes the fake flow with an explicit
  demo label. When the learner chooses to use the manual workflow with an external
  AI tool, its result is reviewed for omissions and inventions before replacing the
  fake lesson.

## Boundaries

- Always: keep API keys server-only, validate all output, visibly distinguish demo
  content, label added examples, preserve last valid data on failure, and record
  schema/prompt versions.
- Ask first: choose or change provider/model, transmit lesson data externally,
  change the canonical schema, add prompt caching, or raise output limits.
- Never: persist invalid output, send a client-supplied arbitrary prompt, log lesson
  content/provider payloads, present fake output as source-derived, trust
  client-supplied item IDs, guess uncertain noun gender, or silently add facts.

## Success criteria

- Every contract invariant is enforced at runtime and covered by tests.
- A deterministic fake produces a complete lesson that survives refresh.
- A learner can complete the manual copy/paste flow without configuring an API key
  or incurring application API charges.
- Invalid manual input cannot replace the last valid structured lesson.
- Every enabled provider failure class yields a safe, retryable UI state without
  destroying the last valid output.
- Manual comparison against one real PDF finds no unlabeled invented content and
  confirms noun gender/article treatment is useful for A1 review.
- Module verification commands pass.

## Deferred live-provider decision gate

Fake and manual workflows may be implemented without selecting a provider because
they make no external request. Before implementing or enabling a live adapter, the
learner must still:

- select the provider and exact model;
- explicitly approve transmitting extracted lesson text to that provider; and
- approve documented retention, privacy, environment-variable, and cost-control
  assumptions.
