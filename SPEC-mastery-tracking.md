# Spec: Mastery Tracking

Module ID: `mastery-tracking`

Status: Approved on 2026-08-22
Depends on: `lesson-core`, `study-review`, `lesson-quiz`.

## Objective

Let the learner explicitly classify vocabulary and lesson sentences as known,
uncertain, or weak and revisit the uncertain material across lessons. This is manual
prioritization, not a spaced-repetition algorithm.

## User stories and acceptance behavior

- Each vocabulary item and source/additional sentence has a three-state control:
  Know, Not sure, and Don't know.
- Initial state is Not sure (`learning`) so unreviewed items remain discoverable.
- Selecting a state persists immediately, records `lastReviewedAt`, and shows pending,
  success, and recoverable failure feedback. Failed saves revert to the last durable
  state rather than pretending success.
- `/review/weak` shows `weak` items first, then `learning` items, grouped by lesson;
  `known` items are excluded.
- Within a state, older `lastReviewedAt` values appear first, followed by never-reviewed
  items ordered by lesson date newest first and stable item position.
- The weak-items page supports an empty state and links back to lessons.
- Items retain TTS and their French-first/English-supported presentation.
- A quiz result does not automatically change manual mastery state in MVP, but attempt
  history is retained for future prioritization.
- Replacing structured lesson content deletes its old mastery rows only after the
  replacement confirmation defined by `pdf-import`.

## Tech stack and commands

Use Prisma persistence and focused client controls with an accessible server mutation.
Do not introduce background jobs, scheduling, or a spaced-repetition package.

```text
npm test -- mastery-tracking
npm run test:e2e -- mastery-tracking
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
app/review/weak/page.tsx                   Weak-items page
app/api/review-items/[id]/route.ts         State update boundary
components/review/mastery-control.tsx      Three-state control
components/review/weak-item-list.tsx
lib/contracts/mastery.ts
lib/mastery/mastery-repository.ts
lib/mastery/list-weak-items.ts
tests/mastery-tracking/
e2e/mastery-tracking.spec.ts
```

## Data and interface contracts

```text
ReviewItem
- id: UUID
- lessonId: UUID
- structuredItemId: UUID
- itemType: vocabulary|sentence
- status: known|learning|weak
- lastReviewedAt: UTC datetime|null
- createdAt: UTC datetime
- updatedAt: UTC datetime
- unique(lessonId, structuredItemId)
```

Rows are materialized when structured content is accepted, one per vocabulary or
sentence item, with `status=learning` and `lastReviewedAt=null`.

`PATCH /api/review-items/{id}` accepts exactly:

```json
{ "status": "known" }
```

The server sets `lastReviewedAt` to its current UTC time and returns the updated item.
Unknown fields, invalid enum values, missing records, and cross-lesson mismatches are
rejected. Rapid changes are serialized per control; the last acknowledged selection
wins and stale responses cannot overwrite a newer UI choice.

## Code style

Status labels are mapped exhaustively in one domain module and reused by lesson and
weak-review views.

```ts
export const masteryLabels: Record<MasteryStatus, string> = {
  known: "Know",
  learning: "Not sure",
  weak: "Don't know",
};
```

## Testing strategy

- Unit: label mapping, sorting across statuses/timestamps, and stale-response handling.
- Integration: item materialization, uniqueness, valid/invalid transitions, timestamps,
  query filtering/order, cascade deletion, and structured-content replacement.
- Component: keyboard-operable three-state control, non-color labels, pending/success/
  failure announcements, and rollback on failure.
- E2E: mark items across lessons, restart/refresh, confirm persistence and weak-page
  order, then mark all known and observe the empty state.

## Boundaries

- Always: persist each explicit selection, use server timestamps, expose text labels,
  preserve deterministic ordering, and retain quiz attempts independently.
- Ask first: automatically update state from quizzes, add filters beyond weak/learning,
  change the initial status, or add scheduling/spaced repetition.
- Never: infer mastery from page views, hide state behind color alone, mutate mastery
  from TTS use, or implement V2 dashboard/scoring behavior.

## Success criteria

- Every vocabulary and sentence item has exactly one durable manual state.
- State changes survive refresh and process restart; failed changes visibly roll back.
- Weak review deterministically lists weak then learning items and excludes known ones.
- Controls are fully keyboard-operable and understandable without color.
- Module verification commands pass.

## Open questions

None blocking. Quiz-based prioritization and spaced repetition remain explicitly V2.
