import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FeatureCardStack } from "@/components/landing/FeatureCardStack";
import { FEATURE_CARDS } from "@/components/landing/featureCards";

/**
 * The scroll maths can't run in jsdom — every element measures 0×0, so there is
 * no scrollable distance to divide by. What these cover is the part that has to
 * hold regardless of how far the page has scrolled: every card is in the DOM and
 * readable, the jump controls are labelled, and `prefers-reduced-motion` gets a
 * still version rather than a pinned one it can never scroll through.
 */

/** Drives `prefers-reduced-motion`; jsdom has no real media queries. */
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
  setReducedMotion(false);
  window.scrollTo = vi.fn();
});

describe("FeatureCardStack", () => {
  it("renders every card, so nothing is reachable only by scrolling", () => {
    render(<FeatureCardStack />);

    for (const card of FEATURE_CARDS) {
      expect(screen.getByRole("heading", { name: card.title })).toBeInTheDocument();
      expect(screen.getByText(card.description)).toBeInTheDocument();
    }
  });

  it("labels each jump control with the card it leads to", () => {
    render(<FeatureCardStack />);

    for (const card of FEATURE_CARDS) {
      expect(screen.getByRole("button", { name: `Go to ${card.title}` })).toBeInTheDocument();
    }
  });

  it("scrolls the page when a jump control is used", async () => {
    // jsdom reports every height as 0, so the component has no distance to
    // scroll and correctly declines to move. Give it one.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.tagName === "SECTION" ? 4800 : 800;
    });

    render(<FeatureCardStack />);
    await userEvent.click(screen.getByRole("button", { name: `Go to ${FEATURE_CARDS[3].title}` }));

    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );

    vi.restoreAllMocks();
  });

  it("drops the pinned stage under prefers-reduced-motion", () => {
    setReducedMotion(true);
    const { container } = render(<FeatureCardStack />);

    // Nothing sticky, nothing transformed — just the cards, in order.
    expect(container.querySelector(".sticky")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Go to / })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(FEATURE_CARDS.length);
  });
});
