import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CompanionDemo } from "@/components/landing/CompanionDemo";

/**
 * The embed is scripted and self-contained — no session, no model call — so
 * what these cover is the script itself: every question is reachable, every
 * reply lands, and the panel can be taken back to the start.
 *
 * They run with `prefers-reduced-motion` on, which is the branch that skips
 * the companion's thinking delay. That keeps the assertions off a timer
 * without faking one; the delay itself is covered separately.
 */
const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

beforeEach(() => {
  setReducedMotion(true);
});

describe("CompanionDemo", () => {
  it("opens on the companion's greeting, with the first question offered", () => {
    render(<CompanionDemo />);

    expect(screen.getByText(/I'm your Prakriva companion/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What should I make for dinner?" }),
    ).toBeInTheDocument();
  });

  it("answers each question and offers the next one", async () => {
    const user = userEvent.setup();
    render(<CompanionDemo />);

    await user.click(screen.getByRole("button", { name: /click to interact/i }));

    expect(await screen.findByText(/millet khichdi with ghee/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I'm out of millet." }));

    expect(await screen.findByText(/soft rice pongal/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "How has my week gone?" }));

    expect(await screen.findByText(/steadiest meal this week/i)).toBeInTheDocument();
  });

  it("offers a reset once the script runs out, and takes the panel back to the start", async () => {
    const user = userEvent.setup();
    render(<CompanionDemo />);

    await user.click(screen.getByRole("button", { name: /click to interact/i }));
    await user.click(await screen.findByRole("button", { name: "I'm out of millet." }));
    await user.click(await screen.findByRole("button", { name: "How has my week gone?" }));

    const restart = await screen.findByRole("button", { name: /start over/i });
    await user.click(restart);

    expect(screen.queryByText(/millet khichdi with ghee/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What should I make for dinner?" }),
    ).toBeInTheDocument();
  });

  it("holds the reply behind a thinking beat when motion is allowed", async () => {
    setReducedMotion(false);
    const user = userEvent.setup();
    render(<CompanionDemo />);

    await user.click(screen.getByRole("button", { name: /click to interact/i }));

    // The visitor's line is on screen immediately; the reply is not.
    expect(screen.getByText("What should I make for dinner?")).toBeInTheDocument();
    expect(screen.getByLabelText(/companion is typing/i)).toBeInTheDocument();

    expect(
      await screen.findByText(/millet khichdi with ghee/i, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
