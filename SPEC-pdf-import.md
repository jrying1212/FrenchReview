# Spec: PDF Import

Module ID: `pdf-import`

Status: Approved on 2026-08-22
Depends on: `lesson-core`.

## Objective

Let the learner attach one teacher-provided, text-based PDF to a lesson, extract its
selectable text locally on the server, and inspect that text before AI processing.
This module establishes a trustworthy source boundary; it does not perform OCR or
interpret lesson meaning.

## User stories and acceptance behavior

- From a lesson without a PDF, the learner selects or drops one `.pdf` file.
- The UI states the 20 MiB limit and that scanned/image-only PDFs are unsupported.
- The server verifies size, PDF magic bytes, and parseability; browser MIME and file
  extension alone are not trusted.
- During upload/extraction, duplicate submissions are disabled and progress is
  represented as indeterminate rather than fake percentages.
- Success stores the original PDF under an opaque generated name, stores normalized
  extracted text, sets `importStatus=ready`, and shows a collapsible raw-text preview.
- Text preserves reading order and French diacritics as supplied by the extractor;
  runs of horizontal whitespace are normalized without rewriting punctuation.
- Empty/image-only PDFs fail with `NO_SELECTABLE_TEXT`; encrypted files fail with
  `ENCRYPTED_PDF`; malformed files fail with `INVALID_PDF`; size failures use
  `PDF_TOO_LARGE`.
- Retrying replaces the prior PDF only after the replacement is fully validated and
  extracted. A failed replacement leaves the previous successful import intact.
- Replacing source text clears every currently materialized downstream record only
  after explicit confirmation. The initial implementation clears parsed lesson
  content and resets parsing state. Quiz, attempt, and mastery persistence must join
  the same invalidation transaction when those models are introduced.

## Tech stack and commands

Use `pdf-parse` in a server-only adapter, pinned by the lockfile. Keep the extraction
interface library-neutral so a compatibility spike can replace the adapter without
changing consumers. Extraction must run in the Node.js runtime, not Edge or browser
code.

```text
npm test -- pdf-import
npm run test:e2e -- pdf-import
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
app/api/lessons/[id]/pdf/route.ts       Upload/replace endpoint
components/pdf/pdf-upload.tsx           Accessible chooser/drop target
components/pdf/extracted-text.tsx       Debug preview
lib/contracts/pdf-import.ts             Boundary schemas and error codes
lib/pdf/extract-pdf-text.ts             Library-neutral service
lib/pdf/pdf-parse-adapter.ts             Server-only adapter
lib/storage/local-pdf-store.ts           Constrained local file operations
tests/pdf-import/fixtures/               Small synthetic PDF fixtures
tests/pdf-import/                        Unit/integration tests
e2e/pdf-import.spec.ts                   Upload flow
```

## Interface contract

`POST /api/lessons/{id}/pdf` accepts multipart form data with exactly one `file`
part and an optional `confirmReplacement` string set to `true`. Unknown fields,
duplicate fields, and invalid confirmation values are rejected. Maximum request file
size is 20 MiB. Success returns status 200:

```json
{
  "data": {
    "lessonId": "uuid",
    "originalName": "lesson-10.pdf",
    "pageCount": 4,
    "characterCount": 8421,
    "importStatus": "ready"
  }
}
```

Validation and extraction failures return the stable import error codes documented
above. Missing lessons return `LESSON_NOT_FOUND` (404), replacements without explicit
confirmation return `REPLACEMENT_CONFIRMATION_REQUIRED` (409), concurrent source
changes return `IMPORT_CONFLICT` (409), and unexpected failures return
`IMPORT_FAILED` (500). Responses never expose storage keys or local paths.

`extractPdfText(bytes)` returns `{ text, pageCount }` or a typed import error. Raw
text is capped at 120,000 Unicode code points. Content over the cap fails with
`TEXT_TOO_LONG`; silent truncation is forbidden because it could misrepresent the
lesson to the LLM.

Storage keys are generated UUID filenames beneath `data/uploads/`. Original names
are metadata only. Temporary files live beneath the same root and are atomically
renamed after extraction succeeds.

## Code style

All binary and parser concerns stay behind explicit interfaces. Expected user input
failures use typed results; unexpected exceptions are logged server-side and mapped
to `IMPORT_FAILED`.

```ts
export type PdfExtractionResult = {
  text: string;
  pageCount: number;
};
```

## Testing strategy

- Unit: signature, size, filename, whitespace normalization, code-point limit, and
  safe storage-key/path handling.
- Integration fixtures: valid French text with accents, empty/image-only, encrypted,
  malformed, and multi-page PDFs.
- Integration: transactional replace behavior and downstream invalidation.
- E2E: keyboard file selection, success preview, invalid-file recovery, and confirmed
  replacement of a previously parsed lesson.
- Test fixtures must be synthetic and contain no real teacher or learner content.

## Boundaries

- Always: process PDFs server-side, validate actual bytes, use generated storage
  keys, delete failed temporary files, and preserve the previous import on retry failure.
- Ask first: change upload/text limits, add OCR, support multiple PDFs, or send the
  original PDF to an external service.
- Never: trust client paths/MIME, execute embedded content, log extracted text, expose
  local file paths, or commit uploaded/real lesson PDFs.

## Success criteria

- A valid French text PDF uploads, extracts, persists, and previews after refresh.
- Every named error is deterministic and gives the learner an actionable message.
- Image-only and malformed fixtures never proceed to AI parsing.
- A failed replacement cannot destroy the last good source.
- Import tests, type-check, lint, and production build pass.

## Open questions

- During implementation, run a short compatibility spike against Node.js 24 and the
  selected `pdf-parse` release. If it cannot reliably extract the test fixtures,
  update this spec before substituting another server-only adapter.
