export const completeGoldenLesson = {
  grammar: [
    {
      examples: [
        {
          french: "Je suis étudiant.",
          meaningEn: "I am a student.",
          sourceKind: "source",
        },
        {
          french: "Elle est étudiante.",
          meaningEn: "She is a student.",
          sourceKind: "additional_example",
        },
      ],
      explanationEn: "Use être to say who someone is.",
      topic: "The verb être",
    },
  ],
  keyPoints: ["Use bonjour in polite greetings."],
  pronunciationFocus: [
    {
      noteEn: "The final s is silent.",
      sourceKind: "source",
      text: "vous",
    },
  ],
  schemaVersion: 1,
  sentences: [
    {
      french: "Où est l’école ?",
      meaningEn: "Where is the school?",
      noteEn: null,
      sourceKind: "source",
    },
  ],
  summary: "Greetings, introductions, and the verb être.",
  title: "Les salutations",
  vocabulary: [
    {
      definiteArticle: "le",
      displayForm: "le professeur",
      exampleFrench: "Le professeur est ici.",
      exampleMeaningEn: "The teacher is here.",
      french: "professeur",
      gender: "masculine",
      indefiniteArticle: "un",
      meaningEn: "teacher",
      partOfSpeech: "noun",
      sourceKind: "source",
    },
    {
      definiteArticle: "l'",
      displayForm: "l’école",
      exampleFrench: null,
      exampleMeaningEn: null,
      french: "école",
      gender: "feminine",
      indefiniteArticle: "une",
      meaningEn: "school",
      partOfSpeech: "noun",
      sourceKind: "source",
    },
    {
      definiteArticle: "les",
      displayForm: "les vacances",
      exampleFrench: null,
      exampleMeaningEn: null,
      french: "vacances",
      gender: "unknown",
      indefiniteArticle: "des",
      meaningEn: "holidays",
      partOfSpeech: "noun",
      sourceKind: "source",
    },
    {
      definiteArticle: null,
      displayForm: "bonjour",
      exampleFrench: "Bonjour, Élise !",
      exampleMeaningEn: "Hello, Élise!",
      french: "bonjour",
      gender: null,
      indefiniteArticle: null,
      meaningEn: "hello",
      partOfSpeech: "expression",
      sourceKind: "additional_example",
    },
  ],
} as const;

export const minimalGoldenLesson = {
  schemaVersion: 1,
  summary: "A short review.",
  title: "Révision",
} as const;
