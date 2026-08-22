import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/lessons/route";
import type {
  Lesson,
  LessonId,
} from "@/lib/contracts/lesson";
import {
  createLessonResponse,
  listLessonsResponse,
} from "@/lib/lessons/lesson-api";
import type { LessonRepository } from "@/lib/lessons/lesson-repository";
import { LessonForm } from "@/components/lessons/lesson-form";
import { LessonList } from "@/components/lessons/lesson-list";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const lesson: Lesson = {
  id: "6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98" as LessonId,
  title: "Les salutations",
  lessonDate: new Date("2026-08-22T00:00:00.000Z"),
  pdfStorageKey: null,
  pdfOriginalName: null,
  rawText: null,
  parsedContent: null,
  importStatus: "empty",
  parseStatus: "not_started",
  parseErrorCode: null,
  structuredContentSource: null,
  structuredSchemaVersion: null,
  structuredPromptVersion: null,
  structuredModelId: null,
  createdAt: new Date("2026-08-22T09:00:00.000Z"),
  updatedAt: new Date("2026-08-22T09:00:00.000Z"),
};

function createRepository(): LessonRepository {
  return {
    create: vi.fn(async () => lesson),
    list: vi.fn(async () => [lesson]),
    findById: vi.fn(async () => null),
    update: vi.fn(async () => null),
    delete: vi.fn(async () => false),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  push.mockReset();
});

describe("lesson collection API", () => {
  it("rejects malformed JSON before opening the repository", async () => {
    const response = await POST(
      new Request("http://localhost/api/lessons", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INVALID_JSON",
        message: "Send a valid JSON request body.",
      },
    });
  });

  it("creates a lesson from validated JSON and returns the stable envelope", async () => {
    const repository = createRepository();

    const response = await createLessonResponse(repository, {
      title: "  Les salutations  ",
      lessonDate: "2026-08-22",
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: {
        ...lesson,
        lessonDate: "2026-08-22T00:00:00.000Z",
        createdAt: "2026-08-22T09:00:00.000Z",
        updatedAt: "2026-08-22T09:00:00.000Z",
      },
    });
    expect(repository.create).toHaveBeenCalledWith({
      title: "Les salutations",
      lessonDate: new Date("2026-08-22T00:00:00.000Z"),
    });
  });

  it("returns accessible field errors without writing invalid input", async () => {
    const repository = createRepository();

    const response = await createLessonResponse(repository, {
      title: "   ",
      lessonDate: "not-a-date",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields and try again.",
        fieldErrors: {
          lessonDate: ["Enter a valid lesson date."],
          title: ["Enter a lesson title."],
        },
      },
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("lists lessons in the repository order and hides persistence details", async () => {
    const repository = createRepository();

    const response = await listLessonsResponse(repository);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          ...lesson,
          lessonDate: "2026-08-22T00:00:00.000Z",
          createdAt: "2026-08-22T09:00:00.000Z",
          updatedAt: "2026-08-22T09:00:00.000Z",
        },
      ],
    });
  });

  it("returns a generic persistence error without exposing internals", async () => {
    const repository = createRepository();
    vi.mocked(repository.create).mockRejectedValue(
      new Error("SQLite file /private/path could not be opened"),
    );

    const response = await createLessonResponse(repository, {
      title: "Lesson 01",
      lessonDate: null,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "PERSISTENCE_ERROR",
        message: "The lesson could not be saved. Please try again.",
      },
    });
  });
});

describe("lesson creation and list UI", () => {
  it("renders a useful empty state with a clear create action", () => {
    render(<LessonList lessons={[]} />);

    expect(
      screen.getByRole("heading", { name: "Your lessons will live here." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create your first lesson" }),
    ).toHaveAttribute("href", "/lessons/new");
  });

  it("renders lesson links in the supplied newest-first order", () => {
    const older = {
      ...lesson,
      id: "27dc0a9c-c4c8-47d9-81a0-6873dc2435a6" as LessonId,
      title: "Les nombres",
      lessonDate: null,
      createdAt: new Date("2026-08-21T09:00:00.000Z"),
    };

    render(<LessonList lessons={[lesson, older]} />);

    const links = [
      screen.getByRole("link", { name: "Les salutations" }),
      screen.getByRole("link", { name: "Les nombres" }),
    ];
    expect(links.map((link) => link.textContent)).toEqual([
      "Les salutations",
      "Les nombres",
    ]);
    expect(screen.getByText("Aug 22, 2026")).toBeInTheDocument();
    expect(screen.getByText("No lesson date")).toBeInTheDocument();
  });

  it("associates API validation feedback with each invalid field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Check the highlighted fields and try again.",
            fieldErrors: {
              lessonDate: ["Enter a valid lesson date."],
              title: ["Enter a lesson title."],
            },
          },
        },
        { status: 422 },
      ),
    );
    render(<LessonForm />);

    fireEvent.submit(screen.getByRole("form", { name: "Create lesson" }));

    expect(
      await screen.findByText("Check the highlighted fields and try again."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Lesson title")).toHaveAttribute(
      "aria-describedby",
      "title-error",
    );
    expect(screen.getByText("Enter a lesson title.")).toHaveAttribute(
      "id",
      "title-error",
    );
  });

  it("redirects to the new lesson after a successful submission", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ data: lesson }, { status: 201 }),
    );
    render(<LessonForm />);

    fireEvent.change(screen.getByLabelText("Lesson title"), {
      target: { value: "Les salutations" },
    });
    fireEvent.change(screen.getByLabelText("Lesson date (optional)"), {
      target: { value: "2026-08-22" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create lesson" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/lessons/6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98",
      );
    });
    expect(fetch).toHaveBeenCalledWith("/api/lessons", {
      body: JSON.stringify({
        lessonDate: "2026-08-22",
        title: "Les salutations",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  });

  it("shows a safe recovery message for a malformed API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        { error: { fieldErrors: { title: [{ unsafe: true }] } } },
        { status: 500 },
      ),
    );
    render(<LessonForm />);

    fireEvent.submit(screen.getByRole("form", { name: "Create lesson" }));

    expect(
      await screen.findByText("The lesson could not be saved. Please try again."),
    ).toHaveAttribute("role", "alert");
    expect(push).not.toHaveBeenCalled();
  });
});
