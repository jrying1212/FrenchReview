"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import {
  GrammarSection,
  SentencesSection,
} from "@/components/review/lesson-language-sections";
import { OverviewSection } from "@/components/review/overview-section";
import { VocabularyList } from "@/components/review/vocabulary-list";
import type { StructuredLesson } from "@/lib/contracts/structured-lesson";

const tabs = ["Overview", "Vocabulary", "Sentences", "Grammar"] as const;
type Tab = (typeof tabs)[number];

export function LessonTabs({ lesson }: { lesson: StructuredLesson }) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectTab(index: number) {
    const tab = tabs[index];
    setActiveTab(tab);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(nextIndex);
  }

  return (
    <section className="lesson-review" aria-labelledby="lesson-review-heading">
      <p className="section-label">Study review</p>
      <h2 id="lesson-review-heading">{lesson.title}</h2>
      <div aria-label="Lesson review sections" className="review-tabs" role="tablist">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`review-panel-${tab.toLowerCase()}`}
            aria-selected={activeTab === tab}
            id={`review-tab-${tab.toLowerCase()}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            role="tab"
            tabIndex={activeTab === tab ? 0 : -1}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      <div
        aria-labelledby={`review-tab-${activeTab.toLowerCase()}`}
        className="review-panel"
        id={`review-panel-${activeTab.toLowerCase()}`}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab === "Overview" ? <OverviewSection lesson={lesson} /> : null}
        {activeTab === "Vocabulary" ? <VocabularyList lesson={lesson} /> : null}
        {activeTab === "Sentences" ? <SentencesSection lesson={lesson} /> : null}
        {activeTab === "Grammar" ? <GrammarSection lesson={lesson} /> : null}
      </div>
    </section>
  );
}
