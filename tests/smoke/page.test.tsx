import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home", () => {
  it("introduces the French review workspace", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "French review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your lessons will live here."),
    ).toBeInTheDocument();
  });
});
