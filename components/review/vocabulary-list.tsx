import { SourceLabel } from "@/components/review/source-label";
import { SpeakerButton } from "@/components/speech/speaker-button";
import type { StructuredLesson } from "@/lib/contracts/structured-lesson";

type VocabularyItem = StructuredLesson["vocabulary"][number];

function VocabularyDetails({ item }: { item: VocabularyItem }) {
  return (
    <dl className="vocabulary-details">
      <div>
        <dt>Part of speech</dt>
        <dd>{item.partOfSpeech}</dd>
      </div>
      {item.partOfSpeech === "noun" ? (
        <>
          <div>
            <dt>Gender</dt>
            <dd>{item.gender}</dd>
          </div>
          <div>
            <dt>Articles</dt>
            <dd>
              Definite: {item.definiteArticle ?? "—"}; Indefinite:{" "}
              {item.indefiniteArticle ?? "—"}
            </dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}

export function VocabularyList({ lesson }: { lesson: StructuredLesson }) {
  if (!lesson.vocabulary.length) {
    return <p className="review-empty">No vocabulary was identified.</p>;
  }

  return (
    <ul className="review-item-list vocabulary-list">
      {lesson.vocabulary.map((item) => (
        <li className="review-item" key={item.id}>
          <div className="review-item-heading">
            <div className="review-item-copy">
              <strong lang="fr">
                {item.partOfSpeech === "noun" ? item.displayForm : item.french}
              </strong>
              <SourceLabel sourceKind={item.sourceKind} />
            </div>
            <SpeakerButton
              label={`Hear ${item.partOfSpeech === "noun" ? item.displayForm : item.french} in French`}
              text={item.partOfSpeech === "noun" ? item.displayForm : item.french}
            />
          </div>
          <p className="meaning-en">{item.meaningEn}</p>
          <VocabularyDetails item={item} />
          {item.exampleFrench ? (
            <div className="language-example">
              <div className="language-example-french">
                <p lang="fr">{item.exampleFrench}</p>
                <SpeakerButton
                  label={`Hear ${item.exampleFrench} in French`}
                  text={item.exampleFrench}
                />
              </div>
              {item.exampleMeaningEn ? <p>{item.exampleMeaningEn}</p> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
