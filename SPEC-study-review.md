# Spec: Study Review and Pronunciation

Module ID: `study-review`

Status: Approved on 2026-08-22
Depends on: `lesson-core`, `lesson-structuring`.

## Objective

Render a validated structured lesson as a calm, French-first A1 study experience and
let the learner hear French text through the browser Speech Synthesis API without
copying content into another tool.

## User stories and acceptance behavior

- `/lessons/{id}` displays tabs or equivalent sections for Overview, Vocabulary,
  Sentences, Grammar, and Quiz; the first four are owned here.
- Overview shows summary and key points.
- Vocabulary shows display form first, English meaning, part of speech, and a textual
  gender label. Masculine, feminine, unknown, and non-noun are visually distinct.
- Sentences show French before English and visibly label additional examples.
- Grammar shows topic, A1 English explanation, and paired examples.
- Pronunciation focus appears on Overview and speaker controls appear beside all
  suitable French vocabulary, examples, sentences, and focus text.
- Activating a speaker cancels current app speech, selects an available `fr-FR`
  voice when possible, sets `lang=fr-FR`, and plays the exact displayed French text.
- The same control replays content. A stop control is available while speaking.
- Unsupported speech synthesis disables playback controls and explains that browser
  or operating-system voice support is required; review content remains usable.
- Route refresh and direct navigation preserve the selected lesson; tab selection
  need not persist across sessions.

## Tech stack and commands

Use server components for lesson reads and focused client components only for tabs,
speech controls, and later mastery controls. Use the browser Web Speech API directly
behind a small adapter; do not add a TTS dependency.

```text
npm test -- study-review
npm run test:e2e -- study-review
npm run typecheck
npm run lint
npm run build
```

## Project structure

```text
app/lessons/[id]/page.tsx                 Review composition
components/review/lesson-tabs.tsx          Navigation
components/review/overview-section.tsx
components/review/vocabulary-list.tsx
components/review/sentence-list.tsx
components/review/grammar-section.tsx
components/review/pronunciation-section.tsx
components/speech/speaker-button.tsx
lib/speech/speech-synthesis-adapter.ts
tests/study-review/
e2e/study-review.spec.ts
```

## Presentation and speech contracts

The UI consumes only validated `StructuredLesson` data. It must not repair or infer
missing AI fields. Display rules:

| Item | Primary line | Supporting content |
|---|---|---|
| Noun | `displayForm` | English, `masculine`/`feminine`/`unknown` |
| Non-noun | `french` | English and part of speech |
| Sentence | French | English and optional note |
| Grammar | Topic | English explanation and examples |
| Pronunciation | French text | English note |

Speech service operations are `isSupported`, `speakFrench(text)`, and `stop`. Empty
text is rejected. Voice discovery accounts for browsers that populate voices after
`voiceschanged`. Selection preference is exact `fr-FR`, then any `fr-*`, then the
browser default while retaining utterance language `fr-FR`. Component unmount and
route changes cancel app-initiated speech.

## Code style

Keep display components pure and semantic. Client boundaries should be leaf-level.
Interaction state is named by meaning rather than DOM detail.

```tsx
<SpeakerButton text={item.french} label={`Hear ${item.french} in French`} />
```

## Testing strategy

- Unit: display selection and voice preference/cancellation with a mocked speech API.
- Component: all content categories, empty categories, labels, unsupported speech,
  keyboard activation, focus visibility, and live status behavior.
- E2E: navigate a full lesson, use tabs at mobile/desktop viewports, and invoke a
  stubbed browser speech API with the exact text and `fr-FR` language.
- Manual: verify understandable playback in the primary local browser; voice quality
  is environment-dependent and is not an automated pass/fail criterion.

## Boundaries

- Always: show French first, retain English support, use semantic controls, label
  gender in text, handle missing speech support, and cancel stale speech.
- Ask first: add Traditional Chinese, speed/voice selectors, an external TTS service,
  or redesign navigation beyond the simple sections/tabs requirement.
- Never: autoplay speech, add pronunciation scoring, hide content behind unsupported
  APIs, or infer corrections in the presentation layer.

## Success criteria

- All validated lesson categories render clearly at mobile and desktop widths.
- A keyboard-only learner can reach every section and operate every speech control.
- Supported browsers receive exact French text with `fr-FR`; unsupported browsers
  retain full non-audio study functionality.
- Masculine, feminine, unknown-gender, and non-noun items are distinguishable without
  relying on color.
- Automated checks and the manual playback check pass.

## Open questions

None blocking. Browser/OS voice differences are an accepted MVP limitation.
