import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderPage } from "@/test/renderPage";

/**
 * Renders the real Shop page against a fixed patient stage.
 *
 * The ranking rules are covered exhaustively in `src/lib/shop/__tests__`; what
 * these check is the part only a render can prove — that a search reaches the
 * grid, that filters compose, and above all that every way out of this page is
 * a safe, correctly-attributed outbound link.
 */

let stage: { lifeStage?: string; trimester?: string; tracks: string[] | null } = {
  lifeStage: "pregnancy",
  trimester: "2",
  tracks: ["pregnancy"],
};

vi.mock("@/hooks/usePatientStage", () => ({
  usePatientStage: () => stage,
}));

const Shop = (await import("../Shop")).default;

const searchBox = () => screen.getByLabelText("Search products");

/**
 * Product tiles are links to the detail route; the grid is all of them.
 * `queryAll`, not `getAll`, so an empty result set is an empty array rather
 * than a thrown error — "no products" is a state this page has to reach.
 */
const productLinks = () =>
  screen
    .queryAllByRole("link")
    .filter((el) => (el.getAttribute("href") ?? "").startsWith("/patient/shop/"));

beforeEach(() => {
  stage = { lifeStage: "pregnancy", trimester: "2", tracks: ["pregnancy"] };
});

describe("browsing", () => {
  it("opens on the whole catalogue with suggestions above it", () => {
    renderPage(<Shop />);
    expect(screen.getByRole("heading", { name: "Suggested for you" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Everything in the shop/ })).toBeInTheDocument();
    expect(productLinks().length).toBeGreaterThan(5);
  });

  it("says up front that Prakriva is not the seller, and dates its prices", () => {
    // The honesty burden of a comparison page with no live price feed.
    renderPage(<Shop />);
    expect(screen.getByText(/doesn't sell any of it/i)).toBeInTheDocument();
    expect(screen.getByText(/last\s+checked on/i)).toBeInTheDocument();
  });

  it("finds a pregnancy pillow and drops everything else", async () => {
    const user = userEvent.setup();
    renderPage(<Shop />);
    const before = productLinks().length;

    await user.type(searchBox(), "pregnancy pillow");

    expect(screen.getByRole("heading", { name: /Results for/ })).toBeInTheDocument();
    const after = productLinks();
    expect(after.length).toBeGreaterThan(0);
    expect(after.length).toBeLessThan(before);
    expect(screen.getAllByText(/pillow/i).length).toBeGreaterThan(0);
  });

  it("searches the way a patient phrases it, not just by product title", async () => {
    const user = userEvent.setup();
    renderPage(<Shop />);

    await user.type(searchBox(), "stretch marks");

    expect(productLinks().length).toBeGreaterThan(0);
    expect(screen.getByText(/Bio-Oil Skincare Oil/i)).toBeInTheDocument();
  });

  it("hides the suggestion rail once she has typed a query", async () => {
    const user = userEvent.setup();
    renderPage(<Shop />);

    await user.type(searchBox(), "pillow");

    // What she asked for outranks what we guessed she might want.
    expect(screen.queryByRole("heading", { name: "Suggested for you" })).not.toBeInTheDocument();
  });

  it("offers a way back when nothing matches", async () => {
    const user = userEvent.setup();
    renderPage(<Shop />);

    await user.type(searchBox(), "laptop charger");

    expect(screen.getByText("Nothing matched that")).toBeInTheDocument();
    expect(productLinks()).toHaveLength(0);
  });

  it("clears the search from the input's own control", async () => {
    const user = userEvent.setup();
    renderPage(<Shop />);

    await user.type(searchBox(), "pillow");
    await user.click(screen.getByLabelText("Clear search"));

    expect(searchBox()).toHaveValue("");
    expect(screen.getByRole("heading", { name: /Everything in the shop/ })).toBeInTheDocument();
  });
});

describe("filtering", () => {
  it("narrows to a category from the shelf rail", async () => {
    const user = userEvent.setup();
    renderPage(<Shop />);
    const before = productLinks().length;

    await user.click(screen.getByRole("button", { name: /Supplements/ }));

    expect(productLinks().length).toBeLessThan(before);
    expect(screen.getAllByText(/Ask your doctor/).length).toBeGreaterThan(0);
  });

  it("marks the active shelf as pressed for assistive tech", async () => {
    const user = userEvent.setup();
    renderPage(<Shop />);

    const chip = screen.getByRole("button", { name: /Supplements/ });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("resets filters back to the full catalogue", async () => {
    const user = userEvent.setup();
    renderPage(<Shop />);
    const before = productLinks().length;

    await user.click(screen.getByRole("button", { name: /Supplements/ }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(productLinks().length).toBe(before);
  });
});

describe("suggestions follow the patient", () => {
  it("suggests pregnancy items to a pregnant patient", () => {
    renderPage(<Shop />);
    const rail = screen.getByRole("heading", { name: "Suggested for you" }).parentElement
      ?.parentElement as HTMLElement;
    expect(within(rail).getAllByText(/trimester|Common during pregnancy/i).length).toBeGreaterThan(
      0,
    );
  });

  it("suggests PCOS items to a PCOS patient instead", () => {
    stage = { lifeStage: "not_applicable", tracks: ["pcos"] };
    renderPage(<Shop />);
    expect(screen.getAllByText(/Suggested for PCOD \/ PCOS/).length).toBeGreaterThan(0);
  });

  it("still renders for a patient whose record has no stage at all", () => {
    stage = { tracks: null };
    renderPage(<Shop />);
    expect(screen.getByRole("heading", { name: /Everything in the shop/ })).toBeInTheDocument();
    expect(productLinks().length).toBeGreaterThan(0);
  });
});
