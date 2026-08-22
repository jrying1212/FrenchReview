import { randomUUID } from "node:crypto";

import {
  generatedQuizDraftSchema,
  type GeneratedQuizDraft,
} from "@/lib/contracts/quiz";
import {
  structuredLessonSchema,
  type StructuredLesson,
} from "@/lib/contracts/structured-lesson";

export function validateGeneratedQuiz(
  input: unknown,
  structuredLesson: StructuredLesson,
): GeneratedQuizDraft {
  const lesson = structuredLessonSchema.parse(structuredLesson);
  const quiz = generatedQuizDraftSchema.parse(input);
  const sourceItemIds = new Set([
    ...lesson.vocabulary.map((item) => item.id),
    ...lesson.sentences.map((item) => item.id),
    ...lesson.grammar.map((item) => item.id),
    ...lesson.pronunciationFocus.map((item) => item.id),
  ]);

  if (
    quiz.questions.some((question) =>
      question.sourceItemIds.some((id) => !sourceItemIds.has(id)),
    )
  ) {
    throw new Error("Quiz references unknown structured lesson items.");
  }

  return quiz;
}

export function createDeterministicFakeQuiz(
  structuredLesson: StructuredLesson,
  generateId: () => string = randomUUID,
): GeneratedQuizDraft {
  const lesson = structuredLessonSchema.parse(structuredLesson);
  const vocabulary = lesson.vocabulary[0];
  const translationVocabulary = lesson.vocabulary[1] ?? vocabulary;
  const distractor = lesson.vocabulary.find(
    (item) =>
      item.id !== vocabulary?.id &&
      normalizedComparable(item.meaningEn) !==
        normalizedComparable(vocabulary?.meaningEn ?? ""),
  );
  const noun = lesson.vocabulary.find(
    (item) => item.partOfSpeech === "noun" && item.definiteArticle !== null,
  );
  const sentence = lesson.sentences.find(
    (item) => tokenizeSentence(item.french).length >= 2,
  );

  if (!vocabulary || !translationVocabulary || !distractor || !noun || !sentence) {
    throw new Error(
      "Structured lesson does not contain enough material for all quiz types.",
    );
  }

  const meaningCorrectOptionId = generateId();
  const meaningDistractorOptionId = generateId();
  const articleOptions = ["le", "la", "l'", "les"].map((text) => ({
    id: generateId(),
    text,
  }));
  const articleCorrectOption = articleOptions.find(
    (option) => option.text === noun.definiteArticle,
  );
  const sentenceTokens = tokenizeSentence(sentence.french).map((text) => ({
    id: generateId(),
    text,
  }));

  if (!articleCorrectOption) {
    throw new Error("The noun does not have a supported definite article.");
  }

  const questions = [
    {
      id: generateId(),
      type: "multiple_choice" as const,
      prompt: `What does « ${vocabulary.french} » mean?`,
      explanationEn: `${vocabulary.displayForm} means ${vocabulary.meaningEn}.`,
      sourceItemIds: [vocabulary.id],
      options: [
        { id: meaningCorrectOptionId, text: vocabulary.meaningEn },
        { id: meaningDistractorOptionId, text: distractor.meaningEn },
      ],
      correctOptionId: meaningCorrectOptionId,
    },
    {
      id: generateId(),
      type: "article_blank" as const,
      prompt: `Choose the definite article: ___ ${noun.french}`,
      explanationEn: `${noun.displayForm} uses the definite article ${noun.definiteArticle}.`,
      sourceItemIds: [noun.id],
      options: articleOptions,
      correctOptionId: articleCorrectOption.id,
    },
    {
      id: generateId(),
      type: "fr_to_en" as const,
      prompt: `Translate into English: ${vocabulary.french}`,
      explanationEn: `${vocabulary.french} means ${vocabulary.meaningEn}.`,
      sourceItemIds: [vocabulary.id],
      acceptedAnswers: [vocabulary.meaningEn],
      referenceAnswer: vocabulary.meaningEn,
    },
    {
      id: generateId(),
      type: "en_to_fr" as const,
      prompt: `Translate into French: ${translationVocabulary.meaningEn}`,
      explanationEn: `${translationVocabulary.meaningEn} is ${translationVocabulary.french} in French.`,
      sourceItemIds: [translationVocabulary.id],
      acceptedAnswers: [translationVocabulary.french],
      referenceAnswer: translationVocabulary.french,
    },
    {
      id: generateId(),
      type: "sentence_ordering" as const,
      prompt: "Put the French sentence in the correct order.",
      explanationEn: `The correct sentence is: ${sentence.french}`,
      sourceItemIds: [sentence.id],
      tokens: rotateRight(sentenceTokens),
      correctTokenIds: sentenceTokens.map((token) => token.id),
    },
  ];

  return validateGeneratedQuiz({ questions }, lesson);
}

function normalizedComparable(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("fr");
}

function tokenizeSentence(sentence: string) {
  return sentence.trim().split(/\s+/u);
}

function rotateRight<T>(items: T[]) {
  return items.length < 2 ? items : [items.at(-1) as T, ...items.slice(0, -1)];
}
