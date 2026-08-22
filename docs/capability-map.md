# Capability Map: French A1 Review MVP

Status: Approved on 2026-08-22.

Product requirements source: `docs/plan.md`.

## Product boundary

Build a local-first, single-user web application that converts a teacher-provided,
text-based French lesson PDF into structured A1 review material, supports browser
pronunciation playback and a short lesson quiz, and lets the learner revisit weak
vocabulary and sentences.

## Modules

| Module ID | Responsibility | Depends on |
|---|---|---|
| `lesson-core` | Application shell, local lesson CRUD, persistence, original PDF metadata, and lesson lifecycle | — |
| `pdf-import` | PDF validation, local storage, selectable-text extraction, extracted-text preview, and extraction errors | `lesson-core` |
| `lesson-structuring` | LLM integration, prompts, validated structured lesson JSON, parsing state, and retry behavior | `lesson-core`, `pdf-import` |
| `study-review` | Lesson overview, vocabulary, sentences, grammar, pronunciation content, and browser text-to-speech | `lesson-core`, `lesson-structuring` |
| `lesson-quiz` | Quiz generation, five question types, answer checking, explanations, scoring, and attempts | `lesson-core`, `lesson-structuring` |
| `mastery-tracking` | Manual knowledge states, review timestamps, weak-item filtering, and weak-items page | `lesson-core`, `study-review`, `lesson-quiz` |
| `lesson-materials` | Primary and supplementary PDF persistence, supplementary library, explicit lesson attachment, and review-staleness signaling | `lesson-core`, `pdf-import` |
| `batch-pdf-import` | Multiple-PDF selection, filename classification preview, duplicate resolution, course-year handling, and per-file import results | `lesson-materials` |
| `material-aware-review` | Combined primary/supplementary source prompts and confirmed replacement of outdated review-derived data | `lesson-materials`, `lesson-structuring`, `lesson-quiz`, `mastery-tracking` |

Build order: `lesson-core` -> `pdf-import` -> `lesson-structuring` ->
`study-review` and `lesson-quiz` -> `mastery-tracking`.

`study-review` and `lesson-quiz` may be implemented in parallel after
`lesson-structuring` is accepted.

Post-MVP build order: `lesson-materials` -> `batch-pdf-import` and
`material-aware-review`. The latter two modules may be specified and implemented on
separate short-lived feature branches after `lesson-materials` is accepted.

## Initiative-wide decisions

- Audience: one A1 French learner using the app on a trusted local machine.
- Explanation language: English. Traditional Chinese is outside MVP.
- Runtime: Node.js 24 LTS.
- Web stack: Next.js 16.3 App Router, React 19, TypeScript 5, and Tailwind CSS 4.
- Persistence: Prisma ORM 7 (current GA line) with a local SQLite database.
- Package manager: npm; exact dependency versions are committed in `package-lock.json`.
- Validation: all untrusted boundary data, including AI output, is runtime-validated.
- Deployment, authentication, multi-user isolation, cloud sync, OCR, speech
  recognition, and spaced repetition are outside MVP.

## Shared commands

These scripts must exist once the application is scaffolded:

```text
Install:     npm ci
Develop:    npm run dev
Type-check: npm run typecheck
Lint:       npm run lint
Unit test:  npm test
Coverage:   npm run test:coverage
E2E test:   npm run test:e2e
Build:      npm run build
DB migrate: npx prisma migrate dev
DB check:   npx prisma validate
```

## Shared project structure

```text
app/                    Next.js routes, pages, loading/error states, route handlers
components/             Reusable presentation and interaction components
lib/                    Domain and infrastructure services
lib/contracts/          Runtime schemas and inferred TypeScript types
prisma/                 Schema, migrations, and development seed
tests/                   Unit and integration tests
e2e/                     Playwright user-flow tests
data/uploads/            Local uploaded PDFs; ignored by Git
docs/tasks/              Approved implementation plans and task lists
```

## Shared quality and accessibility requirements

- Pages work at 320 CSS pixels wide and at desktop widths without horizontal
  scrolling, except inside intentionally scrollable raw-text blocks.
- All functionality is keyboard-operable, focus is visible, controls have
  accessible names, and status changes are announced where appropriate.
- Color is never the only way masculine, feminine, non-noun, or mastery states
  are communicated.
- User-facing failures explain what happened and offer a safe retry or recovery
  action without exposing secrets or raw provider responses.
- Dates are stored as UTC timestamps and displayed in the user's local timezone.

## Shared boundaries

- Always: validate inputs, preserve source French, keep secrets server-only, add
  automated tests for behavior, and run all relevant verification commands.
- Ask first: change the database schema after its module is approved, add a paid
  service, change the LLM provider, raise upload limits, or change CI/deployment.
- Never: commit secrets, uploaded lesson PDFs, SQLite database files, generated
  Prisma clients, or provider payloads containing lesson content; silently invent
  source material; add authentication, OCR, cloud sync, or V2 features to MVP.

## Specification index

- `docs/specs/SPEC-lesson-core.md`
- `docs/specs/SPEC-pdf-import.md`
- `docs/specs/SPEC-lesson-structuring.md`
- `docs/specs/SPEC-study-review.md`
- `docs/specs/SPEC-lesson-quiz.md`
- `docs/specs/SPEC-mastery-tracking.md`
- `docs/specs/SPEC-lesson-materials.md`

The approved `batch-pdf-import` and `material-aware-review` module specs are added to
this index only after their individual Specify gates are approved.

## Initiative success criterion

Using one real, text-based lesson PDF, the learner can create a lesson, obtain a
validated structured review, hear its French content, finish a five-to-ten-minute
quiz, mark uncertain material, close and reopen the app, and revisit that material
without data loss or manual copying into another application.
