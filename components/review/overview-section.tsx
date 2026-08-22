import { SourceLabel } from "@/components/review/source-label";
import { SpeakerButton } from "@/components/speech/speaker-button";
import type { StructuredLesson } from "@/lib/contracts/structured-lesson";

export function OverviewSection({ lesson }: { lesson: StructuredLesson }) {
  return (
    <div className="review-overview">
      <div>
        <p className="review-kicker">Lesson summary</p>
        <p className="review-summary">{lesson.summary}</p>
      </div>
      <div>
        <h3>Key points</h3>
        {lesson.keyPoints.length ? (
          <ul className="key-point-list">
            {lesson.keyPoints.map((point, index) => (
              <li key={`${index}-${point}`}>{point}</li>
            ))}
          </ul>
        ) : (
          <p className="review-empty">No key points were identified.</p>
        )}
      </div>
      <div>
        <h3>Pronunciation focus</h3>
        {lesson.pronunciationFocus.length ? (
          <ul className="review-item-list">
            {lesson.pronunciationFocus.map((item) => (
              <li className="review-item" key={item.id}>
                <div className="review-item-heading">
                  <div className="review-item-copy">
                    <strong lang="fr">{item.text}</strong>
                    <SourceLabel sourceKind={item.sourceKind} />
                  </div>
                  <SpeakerButton
                    label={`Hear ${item.text} in French`}
                    text={item.text}
                  />
                </div>
                <p>{item.noteEn}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="review-empty">No pronunciation focus was identified.</p>
        )}
      </div>
    </div>
  );
}
