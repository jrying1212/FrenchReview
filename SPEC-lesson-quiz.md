# Spec: Lesson Quiz

Module ID: `lesson-quiz`

Status: Approved on 2026-08-22
Depends on: `lesson-core`, `lesson-structuring`.

## Objective

Generate and deliver a short A1 quiz grounded in one structured lesson, give clear
answer feedback and explanations, and persist attempts for later prioritization.

## User stories and acceptance behavior

- A parsed lesson can generate a quiz; generation is disabled for missing or stale
  structured content.
- A quiz targets 8 questions by default and may contain 5-10 when source material is
  limited, suitable for approximately 5-10 minutes.
- Supported types are multiple choice, article fill-in-the-blank, French-to-English,
  English-to-French, and sentence ordering.
- The generator uses only structured lesson content. Distractors may be generated but
  must be plausible, unambiguous, and not introduce a second correct answer.
- The learner completes one question at a time, can revise before submission, and
  receives correctness plus an A1 English explanation after submission.
- Text responses are normalized for surrounding whitespace, repeated whitespace,
  Unicode composition, case, and terminal punctuation. French accents remain
  significant; an accent-only mismatch is marked incorrect with constructive feedback.
- Sentence ordering is evaluated by stable token IDs, not a joined untrusted string.
- Completing all questions shows correct count and percentage and saves one attempt.
- Refresh before final submission may restart the in-progress attempt; only completed
  attempts must persist in MVP.
- Regeneration requires confirmation and does not delete historical attempts.

## Tech stack and commands

Reuse the server-only provider boundary from `lesson-structuring`, with a distinct
quiz prompt and Zod schema. Evaluation is deterministic application logic; the LLM
must never grade submitted answers.

```text
npm test -- lesson-quiz
npm run test:e2e -- lesson-quiz
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
app/api/lessons/[id]/quiz/route.ts         Generate/replace quiz
app/api/lessons/[id]/quiz/attempts/route.ts Submit attempt
components/quiz/quiz.tsx
components/quiz/questions/                  Five question renderers
components/quiz/quiz-results.tsx
lib/contracts/quiz.ts                       Discriminated runtime schema
lib/quiz/generate-quiz.ts
lib/quiz/evaluate-answer.ts                 Deterministic grading
lib/ai/prompts/generate-quiz.ts
tests/lesson-quiz/
e2e/lesson-quiz.spec.ts
```

## Quiz and attempt contracts

```text
Quiz
- id: UUID
- lessonId: UUID
- sourceSchemaVersion: integer
- questions: discriminated union[5..10]
- createdAt: UTC datetime

Common question fields
- id: UUID
- type: multiple_choice|article_blank|fr_to_en|en_to_fr|sentence_ordering
- prompt: string
- explanationEn: string
- sourceItemIds: UUID[1..]

Choice/article question
- options: { id: UUID, text: string }[2..6]
- correctOptionId: UUID

Translation question
- acceptedAnswers: string[1..5]
- referenceAnswer: string

Sentence-ordering question
- tokens: { id: UUID, text: string }[2..20]
- correctTokenIds: UUID[]

QuizAttempt
- id: UUID
- lessonId: UUID
- quizId: UUID
- answers: submitted answer union[]
- results: { questionId, correct, normalizedAnswer }[]
- correctCount: integer
- questionCount: integer
- scorePercent: integer 0..100
- createdAt: UTC datetime
```

Correct answers are never included in the client payload before submission. The
server loads the stored quiz, validates submitted question IDs and answer forms,
grades every answer, persists one immutable attempt, then returns results and
explanations. Reusing a client-generated submission ID makes retry idempotent.

## Code style

Use exhaustive discriminated-union handling. Keep normalization pure and evaluation
independent from rendering and persistence.

```ts
const exhaustive: never = question;
throw new Error(`Unsupported quiz question: ${String(exhaustive)}`);
```

## Testing strategy

- Unit: all five schemas/renderers, answer normalization, accent handling, ordering,
  scoring, exhaustive dispatch, and ambiguous/duplicate choice rejection.
- Property-focused cases: scores remain 0-100 and answer order cannot change question
  identity or correctness.
- Integration: provider validation, hidden answers, idempotent submission, immutable
  saved attempt, and safe regeneration.
- E2E: complete a mixed quiz by keyboard, review explanations and score, refresh, and
  confirm the completed attempt remains available.
- Provider calls are faked in automated tests; one manual quiz from the real lesson
  validates pedagogical quality.

## Boundaries

- Always: ground questions in lesson item IDs, validate generated quizzes, grade on
  the server deterministically, hide answers until submission, and persist attempts.
- Ask first: change grading tolerance, add question types, allow AI grading, or alter
  quiz length outside 5-10.
- Never: penalize whitespace/case alone, silently accept missing accents, expose answer
  keys early, generate from raw unrelated knowledge, or delete attempts on regeneration.

## Success criteria

- A lesson yields a valid 5-10 question quiz with all applicable MVP types.
- Every answer type is rendered, validated, and deterministically scored.
- The learner receives question feedback and a correct aggregate score.
- Completed attempts survive refresh/restart and contain no mutable answer key copy
  supplied by the client.
- Automated checks pass and one real generated quiz is judged unambiguous and A1-level.

## Open questions

- The selected LLM provider/model is inherited from `lesson-structuring` and must be
  resolved before quiz generation implementation.
