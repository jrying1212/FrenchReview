# French Review Tool — Development Plan

## 1. Goal

Build a personal web-based French class review tool that turns teacher-provided PDF notes into structured, interactive review material.

The tool should reduce the need to manually copy sentences into Google Translate just to hear pronunciation, and should help review:

- Vocabulary
- Example sentences
- Grammar
- Pronunciation
- Lesson highlights
- Practice questions

Language preference:

- French should be the primary study language.
- English should be the default explanation / translation language.
- Traditional Chinese can remain optional for difficult grammar explanations if needed later.

The first version is primarily for personal use and should stay simple.

---

## 2. Core User Flow

1. Open the web app.
2. Create or select a lesson.
3. Upload the teacher's PDF notes.
4. Extract text from the PDF.
5. Ask an LLM to organize the lesson content.
6. Review the generated material:
   - Vocabulary
   - Sentences
   - Grammar
   - Key points
7. Click a speaker button to hear French words or sentences.
8. Start a short quiz generated from the lesson.
9. Mark content as:
   - Know
   - Not sure
   - Don't know
10. Revisit weak items later.

---

## 3. MVP Scope

### 3.1 Lesson Management

Each lesson should contain:

- Lesson number / title
- Date
- Original PDF
- Extracted text
- Structured review content
- Quiz
- Review status

Example:

```text
French Course
├── Lesson 01
├── Lesson 02
├── Lesson 03
└── Lesson 10
```

---

### 3.2 PDF Import

Allow the user to upload a PDF from class.

MVP requirements:

- Accept PDF upload.
- Extract selectable text from the PDF.
- Show extracted text for debugging.
- Send extracted text to the LLM.

Out of scope for the first version:

- OCR for scanned PDFs.
- Handwriting recognition.
- Complex slide/image understanding.

If the teacher's PDFs later contain many screenshots or handwritten notes, image/PDF multimodal processing can be added.

---

## 4. AI Lesson Parsing

The LLM should convert the lesson notes into structured JSON.

Suggested schema:

```json
{
  "title": "Lesson 10",
  "summary": "Short lesson summary",
  "vocabulary": [
    {
      "french": "travail",
      "meaning_en": "work",
      "gender": "masculine",
      "article": "le",
      "part_of_speech": "noun",
      "example": "Je vais au travail."
    }
  ],
  "sentences": [
    {
      "french": "Vous faites quoi dans la vie ?",
      "meaning_en": "What do you do for a living?",
      "note": "Common spoken expression"
    }
  ],
  "grammar": [
    {
      "topic": "Articles",
      "explanation_en": "French nouns have grammatical gender.",
      "examples": [
        "un ordinateur",
        "une voiture"
      ]
    }
  ],
  "pronunciation_focus": [
    {
      "text": "treize",
      "note": "Practice the tr + French r sound."
    }
  ],
  "key_points": [
    "Review masculine/feminine articles.",
    "Practice asking about someone's occupation."
  ]
}
```

Important requirements for the prompt:

- Do not invent content not present in the lesson unless clearly labeled as an additional example.
- Keep explanations suitable for an A1 learner.
- Explain grammar primarily in English.
- Preserve original French sentences.
- For every noun, include grammatical gender.
- For every noun, include its most useful article form where possible (for example `le`, `la`, `l'`, `un`, or `une`).
- If noun gender cannot be determined reliably, mark it as `unknown` instead of guessing.
- Include useful example sentences when helpful.

---

## 4.1 Vocabulary Requirements

Vocabulary should be French-first and English-supported.

For nouns, gender is not optional.

Recommended noun display:

```text
le travail
masculine
work

un ordinateur
masculine
computer

la voiture
feminine
car
```

Recommended vocabulary schema:

```json
{
  "french": "voiture",
  "meaning_en": "car",
  "part_of_speech": "noun",
  "gender": "feminine",
  "definite_article": "la",
  "indefinite_article": "une",
  "display_form": "la voiture",
  "example": "La voiture est rouge."
}
```

For non-nouns, `gender` should be `null`.

The UI should visually distinguish:

- masculine
- feminine
- non-noun

Do not infer gender from English translation. Use French lexical knowledge or the source material.

## 5. Review Page

Suggested layout:

```text
Lesson 10

[Summary]

Vocabulary
--------------------------------
le travail        work          masculine   [🔊]
un ordinateur       computer      masculine   [🔊]

Sentences
--------------------------------
Vous faites quoi dans la vie ? [🔊]
What do you do for a living?

Grammar
--------------------------------
Articles: un / une / le / la

Pronunciation
--------------------------------
treize [🔊]
travailler [🔊]

[Start Quiz]
```

Use tabs or sections:

- Overview
- Vocabulary
- Sentences
- Grammar
- Quiz

Do not over-design the first version.

---

## 6. Pronunciation / Text-to-Speech

For MVP, use browser Speech Synthesis API.

Example:

```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.lang = "fr-FR";
speechSynthesis.speak(utterance);
```

Requirements:

- Speaker button beside each word/sentence.
- Use `fr-FR`.
- Allow replay.
- Optional later:
  - Speech speed control.
  - Different voices.
  - Dedicated TTS API if browser quality is insufficient.

Do not build pronunciation scoring in MVP.

---

## 7. Quiz Generation

Generate exercises from each lesson.

MVP question types:

### Multiple Choice

```text
ordinateur means:

A. computer
B. work
C. teacher
D. car
```

### Fill in the Blank

```text
___ ordinateur

A. un
B. une
```

### French → English

```text
Vous travaillez où ?

What does it mean?
```

### English → French

```text
"Where do you work?"

→ ______________________
```

### Sentence Ordering

```text
où / travaillez / vous

→ Vous travaillez où ?
```

The LLM can generate the quiz JSON.

Suggested schema:

```json
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "What does ordinateur mean?",
      "options": ["computer", "work", "school", "table"],
      "answer": "computer",
      "explanation": "ordinateur means computer."
    }
  ]
}
```

---

## 8. Review Status

Each vocabulary item or sentence can have one of three states:

```text
Know
Not sure
Don't know
```

Suggested values:

```text
known
learning
weak
```

Use these states later to prioritize review.

For MVP, manual marking is enough.

---

## 9. Future Review Mode

After enough lesson data exists, add a dashboard such as:

```text
Today's Review

5 vocabulary
3 sentences
4 grammar questions

Weak areas:
- le / la
- un / une
- passé composé
- pronunciation: French R
```

Selection priority:

1. Weak items
2. Not recently reviewed
3. Recent lesson content
4. Previously incorrect quiz questions

A spaced repetition algorithm can be added later.

---

## 10. Suggested Tech Stack

### Frontend / Full Stack

Recommended:

- Next.js
- React
- TypeScript
- Tailwind CSS

Reason:

- Fast to build with Codex.
- Easy UI iteration.
- Can handle frontend + API endpoints in one project.
- Easy deployment.

### Storage

Start with:

- SQLite + Prisma

Alternative:

- Supabase

SQLite is sufficient for local/personal MVP.

### AI

Use an LLM API for:

- Lesson parsing
- Vocabulary extraction
- Grammar explanation
- Quiz generation

Keep prompts and AI calls isolated in a service layer.

Example:

```text
src/
  lib/
    ai/
      parseLesson.ts
      generateQuiz.ts
```

### PDF

Possible libraries:

- pdfjs-dist
- pdf-parse

Choose whichever works cleanly with the selected Next.js environment.

---

## 11. Suggested Project Structure

```text
french-review/
├── app/
│   ├── page.tsx
│   ├── lessons/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   └── api/
│       ├── lessons/
│       ├── parse-pdf/
│       └── generate-quiz/
│
├── components/
│   ├── LessonCard.tsx
│   ├── VocabularyList.tsx
│   ├── SentenceList.tsx
│   ├── GrammarSection.tsx
│   ├── SpeakerButton.tsx
│   └── Quiz.tsx
│
├── lib/
│   ├── ai/
│   │   ├── parseLesson.ts
│   │   └── generateQuiz.ts
│   ├── pdf/
│   │   └── extractPdfText.ts
│   └── speech/
│       └── speakFrench.ts
│
├── prisma/
│   └── schema.prisma
│
└── docs/
    └── plan.md
```

---

## 12. Data Model

Initial model can be simple.

```text
Lesson
- id
- title
- date
- pdfPath
- rawText
- parsedContent
- createdAt

ReviewItem
- id
- lessonId
- type
- content
- status
- lastReviewedAt

QuizAttempt
- id
- lessonId
- score
- answers
- createdAt
```

For MVP, `parsedContent` can be stored as JSON instead of normalizing every vocabulary and sentence into relational tables.

Normalize later only if necessary.

---

## 13. Development Phases

### Phase 1 — Skeleton

Goal: app runs locally.

Build:

- Next.js project
- Basic layout
- Lesson list
- Lesson detail page
- Mock lesson data

No AI yet.

---

### Phase 2 — PDF Upload

Goal: upload a real class PDF.

Build:

- File upload
- PDF text extraction
- Display extracted text

Validate using a real teacher PDF.

---

### Phase 3 — AI Parsing

Goal:

```text
PDF → Structured Lesson
```

Build:

- Lesson parsing prompt
- JSON schema
- LLM API call
- Validation
- Store result
- Render vocabulary / sentences / grammar

This is the most important milestone.

---

### Phase 4 — Pronunciation

Goal:

```text
French text → 🔊
```

Build:

- Speaker button
- Browser SpeechSynthesis
- French voice selection

Apply it to:

- Vocabulary
- Example sentences
- Lesson sentences

---

### Phase 5 — Quiz

Goal:

```text
Lesson → Practice
```

Build:

- Quiz generation
- Multiple choice
- Fill in the blank
- Answer checking
- Explanations
- Score

---

### Phase 6 — Review Tracking

Build:

- Know
- Not sure
- Don't know

Then create a simple "Review Weak Items" page.

---

## 14. Features Explicitly NOT Needed in MVP

Avoid these initially:

- User registration
- Multiple users
- Social features
- Native Android/iOS app
- Speech recognition
- Pronunciation scoring
- Full spaced repetition algorithm
- Flashcard animations
- Gamification
- Streaks
- Leaderboards
- Cloud sync
- OCR
- Fine-tuned AI models
- Complex RAG/vector database

Only add them after the basic review workflow is useful.

---

## 15. MVP Success Criteria

The MVP is successful if this workflow feels useful:

```text
Finish French class
        ↓
Upload teacher PDF
        ↓
Wait for structured lesson
        ↓
Review vocabulary / sentences / grammar
        ↓
Click words to hear pronunciation
        ↓
Do a 5–10 minute quiz
```

The key question is:

> Is this easier and more useful than manually reviewing the PDF and copying sentences into Google Translate?

If yes, continue building.

---

## 16. First Real Test

Use one actual lesson PDF.

Test whether AI correctly extracts:

- Vocabulary
- Important sentences
- Grammar topics
- Teacher examples
- Pronunciation-related content

Do not begin by importing all previous lessons.

Start with one PDF, improve the parsing result, then test another lesson.

---

## 17. Possible V2 Features

After MVP works:

- Daily review dashboard
- Spaced repetition
- Cross-lesson vocabulary search
- Grammar topic index
- Automatically detect recurring mistakes
- Wrong-answer notebook
- "Review before next class"
- Random 10-minute review
- Listening-only mode
- Slow pronunciation playback
- Speech recognition
- Pronunciation comparison
- Conversation exercises
- AI tutor chat limited to learned material
- Export vocabulary to Anki
- Mobile/PWA support

---

## 18. Codex Starting Task

Suggested first instruction to Codex:

```text
Read `docs/plan.md` and build Phase 1 only.

Create a Next.js + TypeScript web application for a personal French course review tool.

Requirements:
- Create a clean lesson list page.
- Create a lesson detail page.
- Use mock data.
- The lesson detail page should contain sections for:
  - Summary
  - Vocabulary
  - Sentences
  - Grammar
  - Pronunciation
  - Quiz
- Do not implement PDF parsing, AI APIs, database integration, or authentication yet.
- Keep components modular because these will be implemented incrementally.
- After implementation, explain the created structure and suggest the next smallest task.
```

Then implement one phase at a time instead of asking Codex to build the entire product in one shot.
