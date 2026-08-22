# Spec: Lesson Materials

Module ID: `lesson-materials`

Status: Approved on 2026-08-22
Depends on: `lesson-core`, `pdf-import`.

## Objective

Let the learner keep supplementary French course PDFs as first-class local materials
and explicitly attach at most one lesson to each supplementary material. Preserve the
existing one-primary-PDF lesson workflow while creating the data and interface
foundation required by later batch import and material-aware review modules.

This module does not classify multiple files, infer relationships with AI, combine
source texts into a new prompt, or replace an existing structured review.

## User stories and acceptance behavior

- The home page exposes two keyboard-operable tabs: `Lessons` and `Supplementary`.
- `Lessons` retains the existing lesson list and creation behavior.
- `Supplementary` lists every supplementary PDF, including independent and attached
  materials. An attached row states `Attached to: {lesson title}` and links to that
  lesson.
- The learner can upload one supplementary text-based PDF from the Supplementary tab
  or directly from a lesson detail page. The existing 20 MiB, byte validation,
  extraction, text cap, error mapping, and local-storage protections apply unchanged.
- A supplementary title defaults to the original filename without `.pdf` and can be
  edited without renaming the stored file.
- A supplementary material may be independent or attached to exactly one lesson. The
  learner can attach, detach, or move it to another lesson; the app never guesses.
- Lesson detail shows its primary PDF and all attached supplementary materials, with
  links to inspect each material's extracted text.
- Attaching, detaching, moving, or deleting an attached supplementary material keeps
  the current structured review, quiz attempts, and mastery intact but marks a lesson
  with existing structured content as `Review update needed`.
- `Review update needed` is durable across refresh/restart. This module does not
  provide the later `Update review` action that clears the flag.
- Deleting a lesson permanently deletes its primary material and existing derived
  lesson data. Attached supplementary materials are preserved and become independent.
- Deleting a supplementary material requires confirmation, removes its PDF and
  extracted text, and marks its attached lesson as needing review update before the
  relationship is removed. A failed file cleanup uses the existing recoverable,
  metadata-only cleanup reporting behavior.
- All mutations serialize per material, show pending/success/recoverable error
  feedback, and cannot leave a false attachment or deletion state after failure.

## Tech stack and commands

Extend the existing Prisma/SQLite persistence and reuse the server-only PDF extraction
and constrained local file store. Add no parsing, upload, state-management, or tab
dependency.

```text
npm test -- lesson-materials
npm run test:e2e -- lesson-materials
npx prisma validate
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
app/api/materials/route.ts                    Create supplementary material
app/api/materials/[id]/route.ts               Read, edit, attach/move/detach, delete
app/supplementary/[id]/page.tsx               Material detail and extracted text
components/materials/home-library-tabs.tsx    Lessons/Supplementary tabs
components/materials/supplementary-list.tsx
components/materials/material-editor.tsx
components/materials/lesson-materials.tsx
lib/contracts/lesson-material.ts
lib/materials/material-repository.ts
lib/materials/material-api.ts
prisma/migrations/*_lesson_material/
tests/lesson-materials/
e2e/lesson-materials.spec.ts
```

## Data and interface contracts

Existing imported lesson PDFs are migrated into `LessonMaterial` rows without moving
their stored files or changing extracted text. No real PDF or database is committed.

```text
LessonMaterial
- id: UUID
- kind: primary|supplementary
- originalName: string
- title: string
- storageKey: opaque UUID PDF filename
- rawText: string
- contentHash: lowercase SHA-256 hex|null
- primaryLessonId: UUID|null, unique
- attachedLessonId: UUID|null
- createdAt: UTC datetime
- updatedAt: UTC datetime

Lesson
- reviewNeedsUpdate: boolean, default false
```

Invariants:

- A `primary` material has one `primaryLessonId` and no `attachedLessonId`.
- A `supplementary` material has no `primaryLessonId` and zero or one
  `attachedLessonId`.
- A lesson has zero or one primary material and any number of attached supplementary
  materials.
- Deleting a lesson cascades to its primary material and sets supplementary
  `attachedLessonId` values to null.
- Every newly uploaded material has a `contentHash`. A migrated legacy primary may
  have null because the existing schema did not persist a hash; the migration must not
  invent one. The hash supports later duplicate suggestions but is not a uniqueness
  constraint because identical files may be intentionally retained.
- Cross-kind mutations and attachment to a missing lesson are rejected.

`POST /api/materials` accepts multipart form data with exactly one `file`, optional
`title`, and optional `attachedLessonId`. It always creates `kind=supplementary`;
clients cannot create a primary material through this endpoint. Success returns 201
with a public material DTO that never exposes `storageKey` or a local path.

`PATCH /api/materials/{id}` accepts exactly one or both of:

```json
{
  "title": "Les nombres",
  "attachedLessonId": "lesson-uuid-or-null"
}
```

At least one field is required. Unknown fields, invalid identifiers, primary-material
mutation, and stale/missing records return stable safe errors. Attachment changes and
the affected lesson's `reviewNeedsUpdate` transition are one database transaction.

`DELETE /api/materials/{id}` accepts no body and deletes only supplementary materials.
The database relationship/update transaction completes before constrained file
cleanup, matching existing lesson deletion recovery semantics.

The existing lesson PDF endpoint remains the primary-material boundary. Its public
behavior is preserved while its repository implementation moves source fields from
`Lesson` to the lesson's primary `LessonMaterial`.

## Code style

Keep material kind invariants in the domain boundary and return public DTOs that omit
storage details.

```ts
export type LessonMaterialKind = "primary" | "supplementary";

export type PublicLessonMaterial = {
  id: string;
  kind: LessonMaterialKind;
  title: string;
  originalName: string;
  attachedLessonId: string | null;
};
```

Use exhaustive kind checks, strict runtime schemas, parameterized Prisma operations,
and existing accessible pending/error/success presentation patterns.

## Testing strategy

- Contract: strict schemas, public DTO omission, title limits, and material-kind
  invariants.
- Migration integration: every existing lesson PDF becomes exactly one primary
  material with unchanged storage key/text; lessons without PDFs remain valid.
- Repository integration: attach, detach, move, cascade primary deletion, preserve and
  detach supplementary materials, review-staleness transitions, and rollback.
- PDF/storage integration: supplementary validation, extraction, hashing, atomic file
  activation, failure cleanup, and constrained deletion.
- Component: accessible tabs, attachment status text, keyboard controls, confirmation,
  pending feedback, failure rollback, and empty states.
- E2E: upload independent supplementary, attach/move/detach, restart, verify lesson
  materials, delete lesson without deleting supplementary, and delete supplementary.
- Regression: existing lesson creation, primary upload/replacement, structured review,
  quiz, mastery, and weak-review suites continue to pass.

## Boundaries

- Always: store PDFs locally under opaque keys, validate bytes server-side, show
  attachment status in text, preserve supplementary materials when deleting lessons,
  and mark affected existing reviews as needing update.
- Ask first: allow one supplementary to attach to multiple lessons, change the 20 MiB
  or text limits, automatically infer attachments, or destructively invalidate review
  data on attachment changes.
- Never: implement multiple-file selection in this module, transmit PDFs/text to an
  external provider, expose storage paths, attach based only on filename, delete an
  attached supplementary when its lesson is deleted, or silently clear quiz/mastery.

## Success criteria

- Existing primary lesson PDFs migrate without data loss or path changes.
- Independent and attached supplementary materials survive refresh and process restart.
- Each supplementary is attached to zero or one lesson, with explicit accessible
  status and deterministic move/detach behavior.
- Supplementary mutations preserve current progress and durably mark affected reviews
  as needing update.
- Lesson deletion preserves attached supplementary materials; supplementary deletion
  removes only the selected material after confirmation.
- Existing MVP behavior and all module verification commands pass.

## Open questions

None blocking. Multiple-file classification belongs to `batch-pdf-import`; combined
source generation and clearing `reviewNeedsUpdate` belong to `material-aware-review`.
