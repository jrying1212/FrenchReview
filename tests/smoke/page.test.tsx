import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

vi.mock("@/lib/lessons/create-lesson-repository", () => ({
  createLessonRepository: () => ({
    disconnect: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
  }),
}));

describe("Home", () => {
  it("introduces the French review workspace", async () => {
    render(await Home());

    expect(
      screen.getByRole("heading", { level: 1, name: "French review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your lessons will live here."),
    ).toBeInTheDocument();
  });
});
