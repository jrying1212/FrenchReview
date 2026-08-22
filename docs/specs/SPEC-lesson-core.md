# Spec: Lesson Core

Module ID: `lesson-core`

Status: Approved on 2026-08-22
Requirements source: `docs/plan.md`; indexed by `docs/capability-map.md`.

## Objective

Provide the local application shell and durable lesson lifecycle on which every
other MVP module depends. A learner can list, create, inspect, rename, date, and
delete lessons, and processing modules can record their state without owning the
lesson itself.

## User stories and acceptance behavior

- The learner lands on `/` and sees lessons newest first plus a clear create action.
- The learner creates a lesson with a required title and optional lesson date.
- A successful create redirects to `/lessons/{id}`.
- The detail page remains useful before import and shows the next available action.
- The learner can edit the title and date.
- Delete requires explicit confirmation and removes the lesson's database records
  and locally stored PDF. A failed file deletion is reported but does not resurrect
  deleted database data; the orphan is logged for manual cleanup.
- Empty, loading, not-found, validation-error, and persistence-error states are
  distinct and accessible.
- Refreshing or restarting the local app does not lose saved lessons.

## Tech stack and commands

Use the initiative stack and commands in `docs/capability-map.md`. The module uses
Next.js server components for reads, route handlers or server actions for mutations,
Prisma ORM 7, SQLite, Zod runtime validation, Vitest, Testing Library, and
Playwright. Do not introduce a client state library for server-owned lesson data.

Module verification:

```text
npm test -- lesson-core
npm run test:e2e -- lesson-core
npx prisma validate
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
app/page.tsx                         Lesson list
app/lessons/new/page.tsx             Lesson creation
app/lessons/[id]/page.tsx            Lesson detail shell
app/api/lessons/route.ts             List/create boundary
app/api/lessons/[id]/route.ts        Read/update/delete boundary
components/lessons/                  Lesson UI
lib/contracts/lesson.ts              Input/output schemas
lib/lessons/lesson-repository.ts     Persistence interface
lib/lessons/prisma-lesson-repository.ts
prisma/schema.prisma                 Durable models and enums
tests/lesson-core/                   Unit/integration coverage
e2e/lesson-core.spec.ts              Core user journey
```

## Domain contract

`Lesson` fields:

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Server-generated, immutable |
| `title` | string | Trimmed, 1-120 characters |
| `lessonDate` | date or null | Calendar date supplied by learner |
| `pdfStorageKey` | string or null | Opaque relative key; never a client path |
| `pdfOriginalName` | string or null | Display only; sanitized before rendering |
| `rawText` | string or null | Extracted source text |
| `parsedContent` | JSON or null | Contract owned by `lesson-structuring` |
| `importStatus` | enum | `empty`, `extracting`, `ready`, `failed` |
| `parseStatus` | enum | `not_started`, `processing`, `ready`, `failed` |
| `parseErrorCode` | string or null | Stable machine-readable code only |
| `createdAt` | UTC datetime | Server-generated |
| `updatedAt` | UTC datetime | Updated on mutation |

The repository exposes list, find, create, update, and delete operations. Consumers
depend on this interface rather than Prisma directly. API success responses use
`{ "data": ... }`; errors use `{ "error": { "code": string, "message": string,
"fieldErrors"?: object } }` and an appropriate HTTP status.

Deletion is a deliberate hard delete in this personal MVP. Cascades remove review
items and quiz attempts. Local file cleanup is constrained to `data/uploads/` and
must reject any resolved path outside that directory.

## Code style

Use strict TypeScript, kebab-case filenames, PascalCase components/types,
camelCase functions/variables, named exports, and small functions with explicit
boundary types. Domain code must not import UI modules.

```ts
export async function createLesson(input: CreateLessonInput): Promise<Lesson> {
  const value = createLessonSchema.parse(input);
  return lessonRepository.create(value);
}
```

## Testing strategy

- Unit: schemas, title/date normalization, state transitions, and path-safety helper.
- Integration: CRUD against an isolated temporary SQLite database; cascade deletion;
  stable success/error envelopes.
- Component: empty, loading, error, and populated lesson list/detail states.
- E2E: create, rename, reopen, and confirmed delete using keyboard controls.
- Coverage target: at least 90% branches for domain and validation modules; no
  numeric target for declarative page markup.

## Boundaries

- Always: perform mutations server-side, validate identifiers and input, constrain
  file cleanup to the upload root, and render safe recovery states.
- Ask first: soft-delete behavior, normalized parsed-content tables, additional
  lesson fields, or any schema migration after this module is accepted.
- Never: expose absolute paths, accept client-selected IDs/statuses, add accounts,
  or store a PDF/database in Git.

## Success criteria

- All listed user behaviors pass automated tests.
- The database survives a process restart and returns unchanged lesson data.
- Invalid title, date, or identifier produces a safe 4xx response and inline UI
  feedback rather than a server crash.
- A lesson detail shell works in every lifecycle state expected by downstream modules.
- The module verification commands pass from a clean checkout after documented setup.

## Open questions

None blocking. The product assumptions approved on 2026-08-22 apply.
