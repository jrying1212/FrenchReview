# French Review

A local-first, single-user web application for reviewing French A1 lesson PDFs.
It extracts text, accepts locally validated structured lesson JSON, generates quizzes,
speaks French with the browser, and tracks manual mastery without a paid AI API.

## Documentation

- [Product requirements](docs/plan.md)
- [Capability map](docs/capability-map.md)
- [Approved specifications](docs/specs/)
- [Implementation plan and task history](docs/tasks/)

## Requirements

- Node.js 24
- npm 11
- A Chromium-based browser for automated browser tests

## Quick start

```bash
npm ci
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To test a production build:

```bash
npm run build
npm start
```

`DATABASE_URL` is optional. When omitted, the app uses `file:./prisma/dev.db`.
Use a Prisma SQLite URL to select another database, for example
`DATABASE_URL=file:./prisma/review.db`.

## Review workflow

1. Create a lesson and upload a text-based PDF (maximum 20 MiB).
2. Inspect the locally extracted text.
3. Choose one structuring workflow:
   - **Demo:** Generate deterministic sample content locally. It is useful for testing
     but is not derived from the PDF.
   - **Manual:** Copy the generated prompt into an AI tool you choose, then paste the
     returned JSON into the app. The app validates and stores it locally.
4. Review vocabulary, sentences, grammar, pronunciation, and browser speech.
5. Generate and complete the deterministic lesson quiz.
6. Mark vocabulary and sentences as Know, Not sure, or Don't know.
7. Open **Review weak items** to revisit Not sure and Don't know items across lessons.

The application has no live LLM integration in this MVP. It does not transmit lesson
text, prompts, or PDFs to OpenAI, Anthropic, or another provider. Copying a prompt into
an external AI tool is an explicit user action and is governed by that tool's account,
pricing, privacy, and retention terms. No API key is required by this application.

## Local data and privacy

All application-managed data remains on the machine running the server:

| Data | Default location | Notes |
| --- | --- | --- |
| Lessons, extracted text, reviews, quizzes, attempts, mastery | `prisma/dev.db` | Local SQLite database |
| Uploaded PDFs | `data/uploads/` | Random UUID filenames with owner-only permissions |
| Browser speech | Browser/operating-system speech service | French voices depend on browser and OS |

The database, uploaded PDFs, `.env*` files, test reports, and generated Prisma client
are excluded from Git. The only production log currently emitted is a metadata-only
cleanup error containing a stable error code and lesson ID; lesson text, PDF bytes,
structured content, and secrets are not logged.

Deleting a lesson permanently removes its database record, dependent quiz/mastery
records, and uploaded PDF. If PDF cleanup fails after database deletion, the app
reports a generic cleanup failure and an orphaned file may remain in `data/uploads/`.

## Backup, removal, and recovery

Stop the server before copying or restoring data so the SQLite database and PDFs
represent the same point in time.

To back up the complete library, copy both `prisma/dev.db` (or the file selected by
`DATABASE_URL`) and `data/uploads/` together. To restore, install dependencies, run
`npm run db:migrate`, stop the server, and replace both locations with the paired
backup before restarting.

To remove one lesson, use **Delete lesson** on its detail page. To remove all local
application data, stop the server and delete the selected SQLite database plus
`data/uploads/`. These deletions are not recoverable without a backup. Re-running
`npm run db:migrate` creates an empty database.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install locked dependencies and generate Prisma client code |
| `npm run db:migrate` | Apply committed SQLite migrations |
| `npm run dev` | Start the development server |
| `npm run build` | Create the production build |
| `npm start` | Run the production build |
| `npm test` | Run unit, component, and integration tests |
| `npm run test:e2e` | Run the Playwright browser suite |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Run ESLint |

Complete verification gate:

```bash
npm test
npm run test:e2e
npx prisma validate
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Playwright uses the separate, Git-ignored `prisma/e2e.db`; browser tests do not write
lesson records to the default personal database.

## Limitations

- This is a local, single-user MVP with no authentication, synchronization, hosted
  deployment, telemetry, or remote backup.
- Scanned/image-only and encrypted PDFs are rejected; OCR is not included.
- Replacing a PDF or structured review requires confirmation and replaces associated
  derived review state.
- Quiz generation is deterministic; it does not call an LLM or change mastery.
- Mastery is manual prioritization, not spaced repetition or scheduling.
- Speech synthesis depends on browser support and available French voices.
- Live AI integration, batch PDF import, and automatic lesson generation are outside
  the approved MVP.

## Known dependency audit finding

As of 2026-08-22, `npm audit` reports GHSA-ggr8-5vv4-36mx through
`prisma -> @prisma/config -> deepmerge-ts@7.1.5`. The latest stable Prisma release is
7.9.1 and still declares that dependency; npm's suggested Prisma 6.12 downgrade is a
breaking change and was not applied. The affected merge code belongs to Prisma's
local CLI/configuration path and is not exposed to lesson/PDF input or an application
HTTP endpoint. Keep Prisma configuration trusted and re-run the audit when upgrading
to a stable Prisma release that uses `deepmerge-ts` 8 or later.
