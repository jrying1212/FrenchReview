import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GenerationStatus } from "@/components/ai/generation-status";
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

function renderStatus(
  overrides: Partial<React.ComponentProps<typeof GenerationStatus>> = {},
) {
  return render(
    <GenerationStatus
      contentSource={null}
      contentTitle={null}
      isSourceReady
      lessonId={lessonId}
      parseErrorCode={null}
      parseStatus="not_started"
      {...overrides}
    />,
  );
}

describe("GenerationStatus", () => {
  it("does not offer generation before a readable PDF is ready", () => {
    renderStatus({ isSourceReady: false });

    expect(
      screen.queryByRole("button", { name: /generate demo lesson/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Import a readable PDF to unlock demo generation."),
    ).toBeVisible();
  });

  it("submits an empty request once, announces progress, and refreshes", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    renderStatus();

    const button = screen.getByRole("button", { name: "Generate demo lesson" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Generating demo lesson…",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/lessons/${lessonId}/structure`, {
      body: "{}",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    resolveResponse(
      Response.json({
        data: {
          lesson: { title: "Demo French A1 review" },
          provenance: { source: "fake" },
        },
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Demo lesson generated successfully.",
    );
  });

  it("keeps persisted demo content visible and offers regeneration", () => {
    renderStatus({
      contentSource: "fake",
      contentTitle: "Demo French A1 review",
      parseStatus: "ready",
    });

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(
      "This is deterministic demo content. It was not derived from your PDF.",
    );
    expect(note).toHaveTextContent("Current demo: Demo French A1 review");
    expect(
      screen.getByRole("button", { name: "Regenerate demo lesson" }),
    ).toBeEnabled();
  });

  it("shows a safe retryable error without hiding prior demo content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "PROVIDER_RATE_LIMIT",
            message: "Lesson generation is temporarily unavailable. Try again.",
          },
        },
        { status: 429 },
      ),
    );
    renderStatus({
      contentSource: "fake",
      contentTitle: "Previous demo lesson",
      parseErrorCode: "PROVIDER_RATE_LIMIT",
      parseStatus: "failed",
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Retry demo generation" }),
    );

    expect(
      await screen.findByText(
        "Lesson generation is temporarily unavailable. Try again.",
      ),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Current demo: Previous demo lesson",
    );
  });

  it("recovers safely from network and invalid response failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("private network detail"))
      .mockResolvedValueOnce(Response.json({ unexpected: true }));
    renderStatus();
    const button = screen.getByRole("button", { name: "Generate demo lesson" });

    fireEvent.click(button);
    expect(
      await screen.findByText("The demo lesson could not be generated. Try again."),
    ).toBeVisible();
    fireEvent.click(button);
    expect(
      await screen.findByText(
        "The lesson was generated, but the response was invalid. Refresh the page.",
      ),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
