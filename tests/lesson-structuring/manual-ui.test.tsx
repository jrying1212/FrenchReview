import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManualLessonImport } from "@/components/ai/manual-lesson-import";
import type { LessonId } from "@/lib/contracts/lesson";

const lessonId = "11111111-1111-4111-8111-111111111111" as LessonId;
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  refresh.mockReset();
});

function promptResponse(user = 'LESSON_SOURCE_JSON\n"Bonjour"') {
  return Response.json({
    data: {
      prompt: {
        responseSchema: { additionalProperties: false, type: "object" },
        system: "System instructions",
        user,
        version: "lesson-structure-v1",
      },
    },
  });
}

function renderImport(
  overrides: Partial<React.ComponentProps<typeof ManualLessonImport>> = {},
) {
  return render(
    <ManualLessonImport
      contentSource={null}
      contentTitle={null}
      isSourceReady
      lessonId={lessonId}
      sourceKey="source-one.pdf"
      {...overrides}
    />,
  );
}

describe("ManualLessonImport", () => {
  it("does not expose source-copying controls before the PDF is ready", () => {
    renderImport({ isSourceReady: false });

    expect(screen.getByText(/Import a readable PDF/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Copy prompt" })).toBeNull();
    expect(screen.queryByLabelText("Paste structured lesson JSON")).toBeNull();
  });

  it("copies the local prompt and schema while explaining the external boundary", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(promptResponse());
    renderImport();

    expect(
      screen.getByText(/The app does not send your PDF or prompt anywhere/),
    ).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copy prompt" })).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "System instructions\n\nLESSON_SOURCE_JSON\n\"Bonjour\"",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON Schema" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        JSON.stringify(
          { additionalProperties: false, type: "object" },
          null,
          2,
        ),
      ),
    );
  });

  it("reloads the copyable prompt when the persisted PDF source changes", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(promptResponse())
      .mockResolvedValueOnce(promptResponse('LESSON_SOURCE_JSON\n"Au revoir"'));
    const { rerender } = renderImport();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copy prompt" })).toBeEnabled(),
    );

    rerender(
      <ManualLessonImport
        contentSource={null}
        contentTitle={null}
        isSourceReady
        lessonId={lessonId}
        sourceKey="source-two.pdf"
      />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copy prompt" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'System instructions\n\nLESSON_SOURCE_JSON\n"Au revoir"',
      ),
    );
  });

  it("preserves pasted text and prior content after a safe validation error", async () => {
    const pasted = '{"schemaVersion":1,"unknown":true}';
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) =>
      init?.method === "PUT"
        ? Response.json(
            {
              error: {
                code: "INVALID_CONTENT",
                message: "The pasted JSON does not match the lesson schema.",
              },
            },
            { status: 422 },
          )
        : promptResponse(),
    );
    renderImport({ contentSource: "fake", contentTitle: "Previous demo" });

    const textarea = screen.getByLabelText("Paste structured lesson JSON");
    fireEvent.change(textarea, { target: { value: pasted } });
    fireEvent.click(screen.getByRole("button", { name: "Review import" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace saved review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The pasted JSON does not match the lesson schema.",
    );
    expect(textarea).toHaveValue(pasted);
    expect(screen.getByText("Current saved review: Previous demo")).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("requires confirmation before replacing and allows cancellation", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(promptResponse());
    renderImport({ contentSource: "manual", contentTitle: "Current lesson" });
    const textarea = screen.getByLabelText("Paste structured lesson JSON");
    fireEvent.change(textarea, { target: { value: '{"schemaVersion":1}' } });

    fireEvent.click(screen.getByRole("button", { name: "Review import" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Replace “Current lesson”?",
    );
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(textarea).toHaveValue('{"schemaVersion":1}');
  });

  it("imports a valid draft, refreshes, and renders durable manual provenance", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) =>
      init?.method === "PUT"
        ? Response.json({
            data: {
              lesson: { title: "Imported review" },
              provenance: { source: "manual" },
            },
          })
        : promptResponse(),
    );
    const { rerender } = renderImport();
    fireEvent.change(screen.getByLabelText("Paste structured lesson JSON"), {
      target: { value: '{"schemaVersion":1}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import JSON" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Manual lesson imported successfully.",
    );

    rerender(
      <ManualLessonImport
        contentSource="manual"
        contentTitle="Imported review"
        isSourceReady
        lessonId={lessonId}
        sourceKey="source-one.pdf"
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent("Manual content");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Current manual review: Imported review",
    );
  });
});
