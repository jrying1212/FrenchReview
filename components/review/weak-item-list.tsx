"use client";

import Link from "next/link";
import { useState } from "react";

import { MasteryControl } from "@/components/review/mastery-control";
import { SpeakerButton } from "@/components/speech/speaker-button";
import { SpeechProvider } from "@/components/speech/speech-provider";
import type { WeakReviewGroup } from "@/lib/mastery/list-weak-items";

export function WeakItemList({ groups: initialGroups }: { groups: WeakReviewGroup[] }) {
  const [groups, setGroups] = useState(initialGroups);

  function removeKnown(itemId: string) {
    setGroups((current) =>
      current
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.reviewItem.id !== itemId),
        }))
        .filter((group) => group.items.length > 0),
    );
  }

  if (!groups.length) {
    return (
      <section className="empty-state" aria-labelledby="weak-empty-heading">
        <div>
          <p className="section-label">Weak review</p>
          <h2 id="weak-empty-heading">Nothing needs extra review.</h2>
          <p>Items marked Not sure or Don&apos;t know will appear here.</p>
          <Link className="text-link" href="/">Return to lessons</Link>
        </div>
      </section>
    );
  }

  return (
    <SpeechProvider>
      <div className="weak-review-groups">
        {groups.map((group) => (
          <section key={group.lessonId} aria-labelledby={`lesson-${group.lessonId}`}>
            <div className="section-heading-row">
              <h2 id={`lesson-${group.lessonId}`}>{group.lessonTitle}</h2>
              <Link href={`/lessons/${group.lessonId}`}>Open lesson</Link>
            </div>
            <ul className="review-item-list">
              {group.items.map((item) => (
                <li className="review-item" key={item.reviewItem.id}>
                  <div className="review-item-heading">
                    <div>
                      <strong lang="fr">{item.french}</strong>
                      <p className="meaning-en">{item.meaningEn}</p>
                    </div>
                    <SpeakerButton label={`Hear ${item.french} in French`} text={item.french} />
                  </div>
                  <MasteryControl
                    item={item.reviewItem}
                    itemLabel={item.french}
                    onSaved={(saved) => {
                      if (saved.status === "known") removeKnown(saved.id);
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SpeechProvider>
  );
}
