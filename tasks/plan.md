# Implementation Plan: French A1 Review MVP

Status: Approved on 2026-08-22

Requirements: `CAPABILITY-MAP.md` and the six approved `SPEC-*.md` files.
Detailed task tracking: `tasks/todo.md`.

## Overview

Build the local-first application in dependency order while delivering a working
vertical slice every few tasks. Start with durable lesson management, validate the
highest-risk PDF and AI boundaries early, then add study, quiz, and manual mastery
flows over stable contracts. Deployment and all V2 features remain out of scope.

## Architecture decisions

- Use one Next.js 16.3 App Router application on Node.js 24 LTS with TypeScript 5
  and Tailwind CSS 4.
- Prefer server components for reads and validated route handlers for mutations.
  Use focused client components only for browser interactions.
- Use Prisma ORM 7 with SQLite. Domain services depend on repository interfaces,
  not Prisma directly.
- Store PDFs beneath a Git-ignored local upload root using generated storage keys.
  Never expose or accept absolute file paths.
- Runtime-validate all untrusted boundaries with Zod, including AI and quiz output.
- Isolate PDF parsing and LLM SDKs behind replaceable server-only adapters.
- Grade quiz answers deterministically on the server; the LLM never grades learners.
- Use Vitest and Testing Library for unit/component coverage and Playwright for full
  browser flows. CI-style tests use synthetic PDFs and a deterministic fake LLM.
- Logs may contain request IDs, record IDs, timing, safe error codes, and token counts,
  but never PDF text, structured lesson content, prompts containing that content,
  provider payloads, API keys, or learner answers.

## Dependency graph

```text
Toolchain and application shell
    |
    v
Lesson persistence -> lesson CRUD UI
    |
    v
PDF contract -> extraction spike -> transactional upload -> preview UI
    |
    v
Structured lesson schema -> prompt/fake provider -> provider decision gate
    |                                              |
    +----------------------------------------------+
                           |
                           v
                  generation orchestration
                    /                 \
                   v                   v
          study rendering       quiz generation
                   |                   |
                   v                   v
             browser TTS        grading/attempts
                    \                 /
                     v               v
                       mastery state
                            |
                            v
                    full MVP acceptance
```

## Build phases

### Phase 1: Foundation and lesson lifecycle

Tasks 1-4 establish the toolchain, persistence contract, and lesson CRUD. Checkpoint
A proves lesson data survives restart and that deletion is constrained and explicit.

### Phase 2: Trusted PDF source

Tasks 5-7 prove parser compatibility before building transactional upload/storage and
the accessible extracted-text preview. Checkpoint B uses synthetic fixtures plus one
uncommitted, user-supplied teacher PDF.

### Phase 3: Structured lesson and study experience

Tasks 8-13 define AI output first, pause for provider/data-sharing approval, integrate
one provider, persist validated results, render study content, and add browser TTS.
Checkpoint C requires human source-fidelity review of one real generated lesson.

### Phase 4: Quiz

Tasks 14-18 implement validated generation, safe persistence, deterministic grading,
all five interactions, and completed attempts. Checkpoint D completes one real mixed
quiz and evaluates pedagogical quality.

### Phase 5: Mastery and MVP acceptance

Tasks 19-22 add durable manual states, controls, weak-item review, and final integrated
documentation/verification. Checkpoint E is the local MVP release-candidate gate.

## Parallelization and sequencing

- Database migrations, shared schema changes, and provider contracts are sequential.
- Study rendering and quiz contract preparation can proceed independently only after
  the structured lesson contract and generation orchestration are stable.
- Mastery persistence can be prepared after structured item IDs and quiz-attempt
  relationships are stable; its UI waits for study components.
- Tests may be prepared alongside a stable contract, but each checkpoint evaluates
  implementation and tests together.
- No multi-agent execution is assumed by this plan.

## Verification strategy

Each task runs focused tests plus type-check and lint. Route/UI tasks also require a
runtime browser check. Every checkpoint runs:

```text
npm test
npm run typecheck
npm run lint
npm run build
```

Relevant checkpoints additionally run:

```text
npx prisma validate
npm run test:e2e
```

Live LLM calls are excluded from automated tests and used only for explicitly
approved manual acceptance. Real teacher PDFs, databases, and generated output are
never committed.

## Definition of Done

Every task must meet its acceptance criteria and verification steps. New behavior
must be covered by tests that fail without it, all regression tests must remain green,
runtime behavior and error paths must be checked, lint/formatting must pass, changes
must remain scoped and understandable, interfaces and documentation must be current,
security and diagnostics must be reviewed where relevant, and the human must approve
each checkpoint before the next phase begins.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| PDF adapter fails on Node.js 24 or damages French ordering | High | Compatibility task precedes upload UI; keep adapter replaceable |
| PDF is scanned, encrypted, malformed, or too large | Medium | Byte-level checks, deterministic errors, explicit limits, no AI call |
| AI invents content or violates noun rules | High | Strict prompt, runtime schema, one bounded repair, additional-example labels, human comparison |
| Lesson text is transmitted without informed approval | High | Hard decision gate before live adapter; server-only secrets and safe logs |
| Quiz contains ambiguous or leaked answers | High | Source IDs, contract checks, answer-stripped client DTOs, deterministic server grading |
| File/database update partially succeeds | High | Temporary files, atomic rename, database transactions, preserve last valid state |
| Browser lacks a French voice | Medium | Detect capability and preserve complete non-audio review functionality |
| Shared contract churn causes rework | Medium | Approve schemas before consumers and serialize migrations |
| MVP expands into V2 | Medium | Enforce approved module boundaries and ask-first/never lists |

## Decision gate before live AI integration

Before Task 10, the human must:

1. Select the LLM provider and model.
2. Explicitly approve transmitting extracted lesson text to that provider.
3. Confirm the provider retention/privacy assumptions.
4. Approve the environment variable names and model identifier recorded in
   `SPEC-lesson-structuring.md`.

## Open questions

- Which provider/model should Task 10 integrate, and is transmission approved?
- Which installed browser is the primary manual playback target? Automated browser
  acceptance uses Playwright Chromium regardless.
