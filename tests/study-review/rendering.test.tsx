import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { assignStructuredItemIds } from "@/lib/ai/assign-structured-item-ids";
import { LessonTabs } from "@/components/review/lesson-tabs";
import type { ReviewItem } from "@/lib/contracts/mastery";

import {
  completeGoldenLesson,
  minimalGoldenLesson,
} from "../lesson-structuring/golden-cases";

const ids = [
  "21111111-1111-4111-8111-111111111111",
  "31111111-1111-4111-8111-111111111111",
  "41111111-1111-4111-8111-111111111111",
  "51111111-1111-4111-8111-111111111111",
  "61111111-1111-4111-8111-111111111111",
  "71111111-1111-4111-8111-111111111111",
  "81111111-1111-4111-8111-111111111111",
];

function completeLesson() {
  let index = 0;
  return assignStructuredItemIds(
    completeGoldenLesson,
    () => ids[index++],
  );
}

function reviewItemsFor(lesson: ReturnType<typeof completeLesson>): ReviewItem[] {
  return [...lesson.vocabulary, ...lesson.sentences].map((item, index) => ({
    id: `${index + 1}0000000-0000-4000-8000-000000000001`,
    lessonId: "20000000-0000-4000-8000-000000000000",
    structuredItemId: item.id,
    itemType: index < lesson.vocabulary.length ? "vocabulary" : "sentence",
    status: "learning",
    lastReviewedAt: null,
    createdAt: "2026-08-22T09:00:00.000Z",
    updatedAt: "2026-08-22T09:00:00.000Z",
  }));
}

afterEach(cleanup);

describe("structured lesson study rendering", () => {
  it("renders the overview with French-first pronunciation and source labels", () => {
    render(<LessonTabs lesson={completeLesson()} />);

    const panel = screen.getByRole("tabpanel", { name: "Overview" });
    expect(within(panel).getByText(completeGoldenLesson.summary)).toBeVisible();
    expect(
      within(panel).getByText("Use bonjour in polite greetings."),
    ).toBeVisible();
    const pronunciation = within(panel).getByText("vous").closest("li");
    expect(pronunciation).not.toBeNull();
    expect(pronunciation?.textContent).toMatch(
      /vous.*From lesson.*The final s is silent\./,
    );
  });

  it("renders vocabulary French first with English, gender, and articles", () => {
    render(<LessonTabs lesson={completeLesson()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Vocabulary" }));

    const school = screen.getByText("l’école").closest("li");
    expect(school).not.toBeNull();
    expect(school?.textContent).toMatch(
      /l’école.*From lesson.*school.*noun.*feminine.*Definite: l'.*Indefinite: une/,
    );
    const additional = screen.getByText("bonjour").closest("li");
    expect(additional).not.toBeNull();
    expect(additional).toHaveTextContent("Additional example");
    expect(additional).toHaveTextContent("Hello, Élise!");
  });

  it("renders sentence and grammar examples with explicit provenance", () => {
    render(<LessonTabs lesson={completeLesson()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Sentences" }));
    const sentence = screen.getByText("Où est l’école ?").closest("li");
    expect(sentence?.textContent).toMatch(
      /Où est l’école \?.*From lesson.*Where is the school\?/,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Grammar" }));
    const additionalExample = screen.getByText("Elle est étudiante.").closest("li");
    expect(additionalExample).toHaveTextContent("Additional example");
    expect(additionalExample?.textContent).toMatch(
      /Elle est étudiante\..*Additional example.*She is a student\./,
    );
  });

  it("renders mastery choices for every vocabulary item and sentence", () => {
    const lesson = completeLesson();
    render(<LessonTabs lesson={lesson} reviewItems={reviewItemsFor(lesson)} />);

    fireEvent.click(screen.getByRole("tab", { name: "Vocabulary" }));
    expect(screen.getAllByRole("group", { name: /^Mastery for/ })).toHaveLength(
      lesson.vocabulary.length,
    );
    expect(screen.getAllByRole("radio", { name: "Know" })).toHaveLength(
      lesson.vocabulary.length,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Sentences" }));
    expect(screen.getAllByRole("group", { name: /^Mastery for/ })).toHaveLength(
      lesson.sentences.length,
    );
    expect(screen.getByRole("radio", { name: "Not sure" })).toBeChecked();
  });

  it("groups French and provenance separately from aligned speech controls", () => {
    render(<LessonTabs lesson={completeLesson()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Sentences" }));

    const sentence = screen.getByText("Où est l’école ?");
    const copyColumn = sentence.closest(".review-item-copy");
    const heading = sentence.closest(".review-item-heading");
    expect(copyColumn).not.toBeNull();
    expect(copyColumn).toHaveTextContent("From lesson");
    expect(
      within(copyColumn as HTMLElement).queryByRole("button"),
    ).toBeNull();
    expect(
      within(heading as HTMLElement).getByRole("button", {
        name: "Hear Où est l’école ? in French",
      }),
    ).toBeVisible();
  });

  it("supports standard arrow, Home, and End keyboard navigation", () => {
    render(<LessonTabs lesson={completeLesson()} />);
    const overview = screen.getByRole("tab", { name: "Overview" });

    overview.focus();
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Vocabulary" })).toHaveFocus();
    expect(
      screen.getByRole("tabpanel", { name: "Vocabulary" }),
    ).toBeVisible();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Vocabulary" }), {
      key: "End",
    });
    expect(screen.getByRole("tab", { name: "Grammar" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Grammar" }), {
      key: "Home",
    });
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
  });

  it("keeps every category available with clear empty states", () => {
    const lesson = assignStructuredItemIds(minimalGoldenLesson);
    render(<LessonTabs lesson={lesson} />);

    expect(screen.getByText("No key points were identified.")).toBeVisible();
    expect(screen.getByText("No pronunciation focus was identified.")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Vocabulary" }));
    expect(screen.getByText("No vocabulary was identified.")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Sentences" }));
    expect(screen.getByText("No sentences were identified.")).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Grammar" }));
    expect(screen.getByText("No grammar points were identified.")).toBeVisible();
  });
});
