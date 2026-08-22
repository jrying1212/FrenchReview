import { SourceLabel } from "@/components/review/source-label";
import { SpeakerButton } from "@/components/speech/speaker-button";
import type { StructuredLesson } from "@/lib/contracts/structured-lesson";

export function SentencesSection({ lesson }: { lesson: StructuredLesson }) {
  if (!lesson.sentences.length) {
    return <p className="review-empty">No sentences were identified.</p>;
  }

  return (
    <ul className="review-item-list">
      {lesson.sentences.map((item) => (
        <li className="review-item" key={item.id}>
          <div className="review-item-heading">
            <div className="review-item-copy">
              <strong lang="fr">{item.french}</strong>
              <SourceLabel sourceKind={item.sourceKind} />
            </div>
            <SpeakerButton
              label={`Hear ${item.french} in French`}
              text={item.french}
            />
          </div>
          <p className="meaning-en">{item.meaningEn}</p>
          {item.noteEn ? <p className="language-note">{item.noteEn}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function GrammarSection({ lesson }: { lesson: StructuredLesson }) {
  if (!lesson.grammar.length) {
    return <p className="review-empty">No grammar points were identified.</p>;
  }

  return (
    <ul className="grammar-list">
      {lesson.grammar.map((item) => (
        <li className="grammar-item" key={item.id}>
          <h3>{item.topic}</h3>
          <p>{item.explanationEn}</p>
          {item.examples.length ? (
            <ul className="review-item-list grammar-example-list">
              {item.examples.map((example, index) => (
                <li className="review-item" key={`${item.id}-${index}`}>
                  <div className="review-item-heading">
                    <div className="review-item-copy">
                      <strong lang="fr">{example.french}</strong>
                      <SourceLabel sourceKind={example.sourceKind} />
                    </div>
                    <SpeakerButton
                      label={`Hear ${example.french} in French`}
                      text={example.french}
                    />
                  </div>
                  {example.meaningEn ? (
                    <p className="meaning-en">{example.meaningEn}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="review-empty">No examples were provided.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
