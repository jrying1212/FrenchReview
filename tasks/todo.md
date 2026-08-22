# Task List: French A1 Review MVP

Status: Approved on 2026-08-22

Plan: `tasks/plan.md`.

## Standing completion rule

Do not implement until this plan is approved. A task is complete only when its
acceptance criteria, verification, and the Definition of Done in `tasks/plan.md` pass.

## Phase 1: Foundation and lesson lifecycle

## Task 1: Scaffold the verified application shell

**Description:** Create the pinned Next.js/TypeScript/Tailwind application, npm
scripts, test runners, root layout, and ignore rules used by every later slice.

**Acceptance criteria:**
- [x] The App Router project installs reproducibly with npm on Node.js 24.
- [x] Type-check, lint, unit, E2E, and production-build scripts start cleanly.
- [x] Local databases, uploads, environment files, and generated output are ignored.

**Verification:**
- [x] `npm ci && npm run typecheck && npm run lint && npm test && npm run build`
- [x] `npm run test:e2e -- smoke`
- [x] Manually verify `/` at 320px and desktop widths.

**Dependencies:** None

**Files likely touched:** framework scaffold, `package.json`, `playwright.config.ts`,
`vitest.config.ts`, `.gitignore`

**Estimated scope:** Medium (bounded generated-scaffold exception)

## Task 2: Establish lesson persistence

**Description:** Add the initial Prisma/SQLite model and migration, runtime lesson
schemas, repository interface, and repository integration tests.

**Acceptance criteria:**
- [x] Lesson fields, lifecycle enums, and timestamps match `SPEC-lesson-core.md`;
  cascade relationships are added and verified when dependent models are introduced
  in Tasks 15 and 19.
- [x] Repository CRUD and validation pass against isolated temporary SQLite.
- [x] Consumers can use the repository without importing Prisma.

**Verification:**
- [x] `npx prisma validate && npm test -- lesson-core/repository`
- [x] `npm run typecheck && npm run lint`

**Dependencies:** Task 1

**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/*`,
`lib/contracts/lesson.ts`, `lib/lessons/lesson-repository.ts`,
`lib/lessons/prisma-lesson-repository.ts`

**Estimated scope:** Medium

## Task 3: Deliver lesson creation and listing

**Description:** Add a complete vertical path for creating a lesson and viewing the
durable newest-first lesson list, including empty and error states.

**Acceptance criteria:**
- [ ] Valid title/date creation redirects to the lesson detail route.
- [ ] Invalid input gives accessible field feedback without writing data.
- [ ] `/` shows the persisted list newest-first and a useful empty state.

**Verification:**
- [ ] `npm test -- lesson-core/create-list`
- [ ] `npm run test:e2e -- lesson-create-list`
- [ ] `npm run typecheck && npm run lint && npm run build`

**Dependencies:** Task 2

**Files likely touched:** `app/page.tsx`, `app/lessons/new/page.tsx`,
`app/api/lessons/route.ts`, `components/lessons/lesson-form.tsx`,
`tests/lesson-core/create-list.test.tsx`

**Estimated scope:** Medium

## Task 4: Deliver lesson detail, editing, and confirmed deletion

**Description:** Complete the lifecycle-aware detail shell, validated title/date
editing, explicit deletion confirmation, cascades, and upload-root-safe cleanup.

**Acceptance criteria:**
- [ ] Detail navigation distinguishes found, not-found, loading, and failure states.
- [ ] Valid edits persist; invalid edits and cancelled deletion preserve prior data.
- [ ] Confirmed delete removes dependents and cannot clean files outside upload root.

**Verification:**
- [ ] `npm test -- lesson-core/detail-mutations`
- [ ] `npm run test:e2e -- lesson-lifecycle`
- [ ] `npm run typecheck && npm run lint && npm run build`

**Dependencies:** Task 3

**Files likely touched:** `app/lessons/[id]/page.tsx`,
`app/api/lessons/[id]/route.ts`, `components/lessons/lesson-editor.tsx`,
`components/lessons/delete-lesson.tsx`, `tests/lesson-core/detail-mutations.test.tsx`

**Estimated scope:** Medium

## Checkpoint A: Durable lesson lifecycle

- [ ] Tasks 1-4 focused and regression tests pass.
- [ ] Prisma validation, type-check, lint, build, and lifecycle E2E pass.
- [ ] Create, edit, restart, reopen, cancel-delete, and confirm-delete work in-browser.
- [ ] Human approves before Phase 2.

## Phase 2: Trusted PDF source

## Task 5: Prove PDF extraction compatibility

**Description:** Define the extraction contract/error taxonomy and test the pinned
server adapter against synthetic French, empty, encrypted, and malformed PDFs.

**Acceptance criteria:**
- [ ] Valid fixtures preserve French diacritics and expose page/character counts.
- [ ] Unsupported fixtures map deterministically to specified error codes.
- [ ] Node.js 24 compatibility is proven or the spec is revised before substitution.

**Verification:**
- [ ] `npm test -- pdf-import/extraction`
- [ ] `npm run typecheck && npm run lint`

**Dependencies:** Checkpoint A

**Files likely touched:** `lib/contracts/pdf-import.ts`,
`lib/pdf/extract-pdf-text.ts`, `lib/pdf/pdf-parse-adapter.ts`,
`tests/pdf-import/extraction.test.ts`, `tests/pdf-import/fixtures/*`

**Estimated scope:** Medium

## Task 6: Add transactional PDF upload and storage

**Description:** Build validated upload/replacement with limits, generated storage
keys, temporary files, atomic activation, and downstream invalidation.

**Acceptance criteria:**
- [ ] Only one valid PDF up to 20 MiB and 120,000 code points can become active.
- [ ] Failed initial/replacement imports leave no partial state or temporary files.
- [ ] Confirmed replacement invalidates stale parsed, quiz, and mastery records.

**Verification:**
- [ ] `npm test -- pdf-import/upload-storage`
- [ ] `npm run typecheck && npm run lint && npm run build`

**Dependencies:** Task 5

**Files likely touched:** `app/api/lessons/[id]/pdf/route.ts`,
`lib/storage/local-pdf-store.ts`, `lib/pdf/import-pdf.ts`,
`tests/pdf-import/upload-storage.test.ts`, `prisma/schema.prisma`

**Estimated scope:** Medium

## Task 7: Deliver upload and extracted-text preview UI

**Description:** Add accessible file selection/drop, processing/error states,
replacement confirmation, and collapsible extracted-text preview.

**Acceptance criteria:**
- [ ] Limits and all named errors are communicated with recovery actions.
- [ ] Duplicate submission is prevented and no fake percentage is shown.
- [ ] Successful text remains previewable after refresh without exposing paths.

**Verification:**
- [ ] `npm test -- pdf-import/ui`
- [ ] `npm run test:e2e -- pdf-import`
- [ ] Manually verify one user-supplied teacher PDF.

**Dependencies:** Task 6

**Files likely touched:** `components/pdf/pdf-upload.tsx`,
`components/pdf/extracted-text.tsx`, `app/lessons/[id]/page.tsx`,
`tests/pdf-import/ui.test.tsx`, `e2e/pdf-import.spec.ts`

**Estimated scope:** Medium

## Checkpoint B: Trusted PDF import

- [ ] Tasks 5-7 and regressions pass; build/type-check/lint are clean.
- [ ] One real text PDF imports and previews correctly without entering Git.
- [ ] Image-only, encrypted, malformed, oversized, and overlong files recover safely.
- [ ] Human approves before Phase 3.

## Phase 3: Structured lesson and study experience

## Task 8: Define the structured lesson contract

**Description:** Implement the versioned runtime schema, limits, invariants,
application-assigned IDs, and golden validation cases.

**Acceptance criteria:**
- [ ] Every approved content category and maximum size is represented.
- [ ] Noun/non-noun gender/article invariants reject invalid output.
- [ ] Unknown fields and unlabeled additions cannot persist.

**Verification:**
- [ ] `npm test -- lesson-structuring/schema`
- [ ] `npm run typecheck && npm run lint`

**Dependencies:** Checkpoint B

**Files likely touched:** `lib/contracts/structured-lesson.ts`,
`lib/ai/assign-structured-item-ids.ts`,
`tests/lesson-structuring/schema.test.ts`,
`tests/lesson-structuring/golden-cases.ts`

**Estimated scope:** Medium

## Task 9: Build the prompt and fake provider

**Description:** Add the versioned prompt builder and deterministic fake provider for
success, malformed output, timeout, and rate-limit cases.

**Acceptance criteria:**
- [ ] Prompt tests cover A1 English, source fidelity, noun gender, and labels.
- [ ] Fake provider supports every orchestration outcome without network access.
- [ ] Diagnostics contain no source text or provider payload.

**Verification:**
- [ ] `npm test -- lesson-structuring/prompt-provider`
- [ ] `npm run typecheck && npm run lint`

**Dependencies:** Task 8

**Files likely touched:** `lib/ai/prompts/structure-lesson.ts`,
`lib/ai/lesson-structurer.ts`, `lib/ai/providers/fake-lesson-structurer.ts`,
`tests/lesson-structuring/prompt.test.ts`,
`tests/lesson-structuring/fake-provider.test.ts`

**Estimated scope:** Medium

## Decision Gate: LLM provider and data sharing

- [ ] Human selects provider/model.
- [ ] Human approves sending extracted lesson text to it.
- [ ] Retention/privacy assumptions, environment variables, and model ID are added
  to `SPEC-lesson-structuring.md` and approved before Task 10.

## Task 10: Integrate the approved live LLM adapter

**Description:** Add one server-only adapter with structured output, timeouts, safe
error mapping, and metadata-only diagnostics.

**Acceptance criteria:**
- [ ] Provider secrets and SDK imports remain server-only.
- [ ] Authentication, timeout, quota/rate limit, and generic failures map safely.
- [ ] Live and fake adapters satisfy the same provider contract tests.

**Verification:**
- [ ] `npm test -- lesson-structuring/provider-contract`
- [ ] `npm run typecheck && npm run lint && npm run build`
- [ ] One approved manual smoke request succeeds without content/secret logging.

**Dependencies:** Task 9 and provider decision gate

**Files likely touched:** one provider adapter, `lib/ai/providers/index.ts`,
`lib/ai/provider-errors.ts`, `tests/lesson-structuring/provider-contract.test.ts`,
`.env.example`

**Estimated scope:** Medium

## Task 11: Deliver atomic lesson generation and retry

**Description:** Orchestrate persisted source through provider, validation, one repair,
ID assignment, atomic persistence, and accessible retry states.

**Acceptance criteria:**
- [ ] Concurrent requests and client-supplied source/prompts are rejected.
- [ ] Invalid output receives at most one repair and cannot replace last valid data.
- [ ] Success records schema/prompt/model versions and survives refresh.

**Verification:**
- [ ] `npm test -- lesson-structuring/orchestration`
- [ ] `npm run test:e2e -- lesson-generation`
- [ ] `npm run typecheck && npm run lint && npm run build`

**Dependencies:** Task 10

**Files likely touched:** `lib/ai/structure-lesson.ts`,
`app/api/lessons/[id]/structure/route.ts`,
`components/ai/generation-status.tsx`,
`tests/lesson-structuring/orchestration.test.ts`,
`e2e/lesson-structuring.spec.ts`

**Estimated scope:** Medium

## Task 12: Render the structured study experience

**Description:** Deliver responsive Overview, Vocabulary, Sentences, and Grammar views
using validated content with explicit source/additional labels.

**Acceptance criteria:**
- [ ] Every category is French-first with required English/gender support.
- [ ] Empty categories and additional examples are clearly represented.
- [ ] Tabs/sections work by keyboard at 320px and desktop widths.

**Verification:**
- [ ] `npm test -- study-review/rendering`
- [ ] `npm run test:e2e -- study-review`
- [ ] `npm run typecheck && npm run lint && npm run build`

**Dependencies:** Task 11

**Files likely touched:** `app/lessons/[id]/page.tsx`,
`components/review/lesson-tabs.tsx`, `components/review/overview-section.tsx`,
`components/review/vocabulary-list.tsx`,
`components/review/lesson-language-sections.tsx`

**Estimated scope:** Medium

## Task 13: Add resilient French speech playback

**Description:** Add exact-text `fr-FR` playback, voice fallback, replay/stop, cleanup,
and unsupported-browser handling.

**Acceptance criteria:**
- [ ] Exact displayed text prefers exact `fr-FR`, then `fr-*`, then browser default.
- [ ] Starting/replaying and route change cancel stale app speech.
- [ ] Unsupported browsers retain full study functionality with an explanation.

**Verification:**
- [ ] `npm test -- study-review/speech`
- [ ] `npm run test:e2e -- study-speech`
- [ ] Manual playback check in the primary local browser.

**Dependencies:** Task 12

**Files likely touched:** `lib/speech/speech-synthesis-adapter.ts`,
`components/speech/speaker-button.tsx`,
`components/review/pronunciation-section.tsx`,
`tests/study-review/speech.test.tsx`, `e2e/study-speech.spec.ts`

**Estimated scope:** Medium

## Checkpoint C: Structured lesson review

- [ ] Tasks 8-13 and regressions pass; build/type-check/lint are clean.
- [ ] One approved real-provider run produces valid persisted content.
- [ ] Human comparison finds no unlabeled invention and accepts noun/article quality.
- [ ] Study content and speech work with accessible fallbacks.
- [ ] Human approves before Phase 4.

## Phase 4: Lesson quiz

## Task 14: Define quiz schema and generation

**Description:** Add the five-type discriminated schema, grounded source IDs,
generation prompt, ambiguity checks, and deterministic fake outputs.

**Acceptance criteria:**
- [ ] Valid quizzes contain 5-10 supported questions.
- [ ] Choice keys, ordering tokens, translations, and source IDs validate.
- [ ] Duplicate/ambiguous choices and ungrounded questions are rejected.

**Verification:**
- [ ] `npm test -- lesson-quiz/schema-generation`
- [ ] `npm run typecheck && npm run lint`

**Dependencies:** Checkpoint C

**Files likely touched:** `lib/contracts/quiz.ts`,
`lib/ai/prompts/generate-quiz.ts`, `lib/quiz/generate-quiz.ts`,
`tests/lesson-quiz/schema.test.ts`, `tests/lesson-quiz/generation.test.ts`

**Estimated scope:** Medium

## Task 15: Persist and safely expose quizzes

**Description:** Add quiz persistence and confirmed generation/regeneration without
deleting attempts or exposing answer keys in client payloads.

**Acceptance criteria:**
- [ ] Generation reads stored structured content and saves one validated active quiz.
- [ ] Client DTOs omit correct answers and accepted-answer lists.
- [ ] Regeneration requires confirmation and preserves historical attempts.

**Verification:**
- [ ] `npm test -- lesson-quiz/persistence-generation`
- [ ] `npx prisma validate && npm run typecheck && npm run lint && npm run build`

**Dependencies:** Task 14

**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/*`,
`app/api/lessons/[id]/quiz/route.ts`, `lib/quiz/quiz-repository.ts`,
`tests/lesson-quiz/persistence-generation.test.ts`

**Estimated scope:** Medium

## Task 16: Implement deterministic grading and attempts

**Description:** Add normalization, five grading paths, server submission,
idempotency, immutable attempts, scores, and result envelopes.

**Acceptance criteria:**
- [ ] Whitespace/case/punctuation normalize while French accents stay significant.
- [ ] Server-loaded keys produce correct question and aggregate results.
- [ ] Retried submission IDs cannot create duplicate attempts.

**Verification:**
- [ ] `npm test -- lesson-quiz/grading-attempts`
- [ ] `npm run typecheck && npm run lint && npm run build`

**Dependencies:** Task 15

**Files likely touched:** `lib/quiz/evaluate-answer.ts`,
`app/api/lessons/[id]/quiz/attempts/route.ts`,
`lib/quiz/quiz-attempt-repository.ts`, `tests/lesson-quiz/grading.test.ts`,
`tests/lesson-quiz/attempts.test.ts`

**Estimated scope:** Medium

## Task 17: Deliver choice and translation question UI

**Description:** Build accessible multiple-choice, article-blank, French-to-English,
and English-to-French interactions with revisable pre-submit answers.

**Acceptance criteria:**
- [ ] Four variants render from the answer-stripped client contract.
- [ ] Inputs are labeled, keyboard-operable, and revisable before submission.
- [ ] No answer key or correctness signal appears before server submission.

**Verification:**
- [ ] `npm test -- lesson-quiz/choice-translation-ui`
- [ ] `npm run test:e2e -- quiz-choice-translation`
- [ ] `npm run typecheck && npm run lint`

**Dependencies:** Task 16

**Files likely touched:** `components/quiz/quiz.tsx`,
`components/quiz/questions/choice-question.tsx`,
`components/quiz/questions/translation-question.tsx`,
`tests/lesson-quiz/choice-translation-ui.test.tsx`,
`e2e/quiz-choice-translation.spec.ts`

**Estimated scope:** Medium

## Task 18: Deliver ordering, submission, and results UI

**Description:** Add token-based sentence ordering, final submission, explanations,
score display, persistence confirmation, and completed-attempt refresh behavior.

**Acceptance criteria:**
- [ ] Tokens can be ordered and corrected with keyboard controls.
- [ ] Completion shows each explanation plus correct count and percentage.
- [ ] Completed attempts survive refresh; pre-submit refresh may restart.

**Verification:**
- [ ] `npm test -- lesson-quiz/ordering-results-ui`
- [ ] `npm run test:e2e -- lesson-quiz`
- [ ] Manual completion of one mixed 5-10 question quiz.

**Dependencies:** Task 17

**Files likely touched:** `components/quiz/questions/sentence-ordering.tsx`,
`components/quiz/quiz-results.tsx`, `components/quiz/quiz.tsx`,
`tests/lesson-quiz/ordering-results-ui.test.tsx`, `e2e/lesson-quiz.spec.ts`

**Estimated scope:** Medium

## Checkpoint D: Complete lesson quiz

- [ ] Tasks 14-18 and regressions pass; build/type-check/lint are clean.
- [ ] All five question types work by keyboard and grade deterministically.
- [ ] Answers remain hidden before submission; completed attempts persist.
- [ ] Human accepts one real generated quiz as grounded, unambiguous, and A1-level.
- [ ] Human approves before Phase 5.

## Phase 5: Mastery and MVP acceptance

## Task 19: Materialize and query mastery state

**Description:** Add review-item persistence, default materialization, validated state
mutation, server timestamps, and deterministic weak-item queries.

**Acceptance criteria:**
- [ ] Each vocabulary/sentence has one unique initial `learning` row.
- [ ] Valid state changes timestamp correctly; invalid mutations fail safely.
- [ ] Query order is weak then learning with approved secondary ordering.

**Verification:**
- [ ] `npm test -- mastery-tracking/persistence-query`
- [ ] `npx prisma validate && npm run typecheck && npm run lint && npm run build`

**Dependencies:** Checkpoint C and Task 16

**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/*`,
`lib/contracts/mastery.ts`, `lib/mastery/mastery-repository.ts`,
`tests/mastery-tracking/persistence-query.test.ts`

**Estimated scope:** Medium

## Task 20: Add reliable mastery controls

**Description:** Add accessible three-state controls with serialized saves,
stale-response protection, success feedback, and failure rollback.

**Acceptance criteria:**
- [ ] Every vocabulary/sentence shows all three textual state labels.
- [ ] Successful changes persist and announce completion.
- [ ] Failed or stale responses cannot leave a false/older selection displayed.

**Verification:**
- [ ] `npm test -- mastery-tracking/control`
- [ ] `npm run test:e2e -- mastery-control`
- [ ] `npm run typecheck && npm run lint`

**Dependencies:** Task 19

**Files likely touched:** `app/api/review-items/[id]/route.ts`,
`components/review/mastery-control.tsx`,
`components/review/vocabulary-list.tsx`,
`components/review/lesson-language-sections.tsx`,
`tests/mastery-tracking/control.test.tsx`

**Estimated scope:** Medium

## Task 21: Deliver weak-item review

**Description:** Render weak/learning vocabulary and sentences grouped by lesson with
approved ordering, TTS, mastery controls, and an empty state.

**Acceptance criteria:**
- [ ] `/review/weak` excludes known items and orders/groups deterministically.
- [ ] Items retain French-first display, English, TTS, and state controls.
- [ ] Marking all items known produces an accessible empty state and lesson links.

**Verification:**
- [ ] `npm test -- mastery-tracking/weak-page`
- [ ] `npm run test:e2e -- weak-review`
- [ ] `npm run typecheck && npm run lint && npm run build`

**Dependencies:** Task 20

**Files likely touched:** `app/review/weak/page.tsx`,
`components/review/weak-item-list.tsx`, `lib/mastery/list-weak-items.ts`,
`tests/mastery-tracking/weak-page.test.tsx`, `e2e/weak-review.spec.ts`

**Estimated scope:** Medium

## Task 22: Verify and document the complete local MVP

**Description:** Run the full workflow with one real lesson, close integration and
accessibility gaps, and document setup, secrets, storage, backup/removal, limitations,
and recovery.

**Acceptance criteria:**
- [ ] The full approved workflow succeeds from lesson creation to weak review.
- [ ] README records exact commands and all local/external data boundaries.
- [ ] No V2 feature, real PDF/database, secret, debug output, or dead code remains.

**Verification:**
- [ ] `npm test && npm run test:e2e`
- [ ] `npx prisma validate && npm run typecheck && npm run lint && npm run build`
- [ ] Manual 320px/desktop, keyboard, error, restart, and real-PDF checks.

**Dependencies:** Task 21 and Checkpoint D

**Files likely touched:** `README.md`, selected integration/E2E tests, and at most
three small files identified by the final review

**Estimated scope:** Medium

## Checkpoint E: MVP release candidate

- [ ] Every approved specification success criterion traces to passing evidence.
- [ ] Clean-install verification and the complete E2E suite pass.
- [ ] Real-PDF output, pronunciation, quiz, persistence, and weak review are accepted.
- [ ] Security review covers upload bytes, paths, external AI, validation, secrets,
  and content-safe logging.
- [ ] Documentation and recovery instructions match runtime behavior.
- [ ] Human approves the local MVP; deployment remains outside scope.
