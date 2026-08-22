import { SourceLabel } from "@/components/review/source-label";
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
            <strong lang="fr">{item.displayForm}</strong>
            <SourceLabel sourceKind={item.sourceKind} />
          </div>
          <p className="meaning-en">{item.meaningEn}</p>
          <VocabularyDetails item={item} />
          {item.exampleFrench ? (
            <div className="language-example">
              <p lang="fr">{item.exampleFrench}</p>
              {item.exampleMeaningEn ? <p>{item.exampleMeaningEn}</p> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
