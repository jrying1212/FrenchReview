import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExtractedText } from "@/components/pdf/extracted-text";
import { PdfUpload } from "@/components/pdf/pdf-upload";
import type { LessonId } from "@/lib/contracts/lesson";

const lessonId = "6f1ad459-4f8b-4af7-bba6-e31d1f4cbe98" as LessonId;
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  refresh.mockReset();
  vi.restoreAllMocks();
});

function createPdfFile(name = "lesson.pdf"): File {
  return new File(["%PDF-synthetic"], name, { type: "application/pdf" });
}

describe("PDF upload UI", () => {
  it("explains limits and renders persisted extracted text in a disclosure", () => {
    render(
      <>
        <PdfUpload hasPdf={false} lessonId={lessonId} originalName={null} />
        <ExtractedText text="Bonjour à toutes et à tous." />
      </>,
    );

    expect(screen.getByText(/20 MiB/)).toBeVisible();
    expect(screen.getByText(/scanned or image-only PDFs/i)).toBeVisible();
    expect(screen.getByText("Extracted text preview")).toBeVisible();
    expect(screen.getByText("Bonjour à toutes et à tous.")).toBeVisible();
  });

  it("accepts a dropped PDF and prevents duplicate submission while processing", async () => {
    let finishRequest: ((response: Response) => void) | undefined;
    vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise<Response>((resolve) => {
        finishRequest = resolve;
      }),
    );
    render(<PdfUpload hasPdf={false} lessonId={lessonId} originalName={null} />);

    fireEvent.drop(screen.getByText("Drop a PDF here"), {
      dataTransfer: { files: [createPdfFile()] },
    });
    expect(screen.getByText("lesson.pdf")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Upload PDF" }));
    expect(screen.getByRole("button", { name: "Processing PDF…" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Uploading and extracting text…",
    );

    finishRequest?.(
      Response.json({
        data: {
          characterCount: 14,
          importStatus: "ready",
          lessonId,
          originalName: "lesson.pdf",
          pageCount: 1,
        },
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("PDF imported successfully.");
  });

  it("requires confirmation before replacing and sends the confirmation field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        data: {
          characterCount: 14,
          importStatus: "ready",
          lessonId,
          originalName: "replacement.pdf",
          pageCount: 1,
        },
      }),
    );
    render(
      <PdfUpload hasPdf lessonId={lessonId} originalName="current.pdf" />,
    );
    fireEvent.change(screen.getByLabelText("PDF file"), {
      target: { files: [createPdfFile("replacement.pdf")] },
    });

    const replaceButton = screen.getByRole("button", { name: "Replace PDF" });
    fireEvent.click(replaceButton);
    expect(screen.getByRole("alertdialog")).toBeVisible();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    await waitFor(() => expect(replaceButton).toHaveFocus());

    fireEvent.click(replaceButton);
    fireEvent.click(screen.getByRole("button", { name: "Confirm replacement" }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledOnce());
    const request = vi.mocked(globalThis.fetch).mock.calls[0][1];
    const body = request?.body as FormData;
    expect(body.get("confirmReplacement")).toBe("true");
    expect(body.get("file")).toBeInstanceOf(File);
  });

  it("shows an actionable server error and allows another selection", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "NO_SELECTABLE_TEXT",
            message:
              "This PDF has no selectable text. Scanned PDFs are not supported.",
          },
        },
        { status: 422 },
      ),
    );
    render(<PdfUpload hasPdf={false} lessonId={lessonId} originalName={null} />);
    fireEvent.change(screen.getByLabelText("PDF file"), {
      target: { files: [createPdfFile("scan.pdf")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload PDF" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This PDF has no selectable text",
    );
    fireEvent.change(screen.getByLabelText("PDF file"), {
      target: { files: [createPdfFile("text.pdf")] },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("text.pdf")).toBeVisible();
  });
});
