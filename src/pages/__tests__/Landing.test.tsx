import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import renderPage from "@/test/renderPage";

/**
 * The landing page is the app's only public surface, so what is tested here is
 * what a visitor can actually reach: every section, both sign-up doors, the
 * in-page anchors the nav promises, and the demo's tab strip.
 *
 * Deliberately *not* tested: the reveal animations, the card stacking and the
 * cursor spotlight. All three are driven by APIs jsdom does not implement
 * (`IntersectionObserver`, scroll geometry, pointer events with real
 * coordinates), and all three are decoration that the page reads correctly
 * without — `useInView` fails open precisely so that content is visible when
 * the observer is missing. Asserting they are switched off would be testing
 * jsdom, not the page.
 */

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

// The language picker reaches for the translation runtime, which is not what
// this file is about; the header's own behaviour is covered by its presence.
vi.mock("@/components/LanguageSelect", () => ({
  LanguageSwitcher: () => <button type="button">Language</button>,
  LanguageSelect: () => null,
}));

const Landing = (await import("../Landing")).default;

beforeEach(() => {
  navigate.mockClear();
});

describe("the landing page", () => {
  it("renders every section a visitor is promised", () => {
    const { container } = renderPage(<Landing />);

    // The nav links are a contract: each one must have somewhere to land.
    for (const id of ["demo", "how-it-works", "features", "about", "contact"]) {
      expect(container.querySelector(`#${id}`), `#${id} is missing`).not.toBeNull();
    }
    // …and so are the ones only the footer offers.
    for (const id of ["doshas", "roles", "scenarios", "faq"]) {
      expect(container.querySelector(`#${id}`), `#${id} is missing`).not.toBeNull();
    }
  });

  it("points every nav link at a section that exists on the page", () => {
    const { container } = renderPage(<Landing />);
    const nav = screen.getByRole("navigation", { name: /primary/i });

    const anchors = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => !!href && href.startsWith("#") && href !== "#top");

    expect(anchors.length).toBeGreaterThan(0);
    for (const href of anchors) {
      expect(container.querySelector(href), `${href} has no target`).not.toBeNull();
    }
  });

  it("sends a patient and a practitioner to their own sign-up routes", async () => {
    const user = userEvent.setup();
    renderPage(<Landing />);

    await user.click(screen.getByRole("button", { name: /start your profile/i }));
    expect(navigate).toHaveBeenCalledWith("/auth/patient");

    navigate.mockClear();
    await user.click(screen.getByRole("button", { name: /join as a practitioner/i }));
    expect(navigate).toHaveBeenCalledWith("/auth/doctor");
  });

  it("names the brand exactly once per lockup", () => {
    renderPage(<Landing />);

    // The butterfly is `aria-hidden` so the wordmark beside it is the single
    // accessible name; two would make every lockup read as "Prakriva Prakriva".
    const headerLink = screen.getByRole("link", { name: /prakriva — back to top/i });
    expect(headerLink).toBeInTheDocument();
  });

  it("switches the demo panel when a tab is chosen", async () => {
    const user = userEvent.setup();
    renderPage(<Landing />);

    const tabs = screen.getByRole("tablist", { name: /product screens/i });
    const doctorTab = within(tabs).getByRole("tab", { name: "Doctor" });

    expect(within(tabs).getByRole("tab", { name: "Today" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(doctorTab);

    expect(doctorTab).toHaveAttribute("aria-selected", "true");
    // The doctor screen's own content, not just the tab state.
    expect(screen.getByText(/needs review/i)).toBeInTheDocument();
  });

  it("opens and closes the mobile menu", async () => {
    const user = userEvent.setup();
    renderPage(<Landing />);

    const toggle = screen.getByRole("button", { name: /open menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: /close menu/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: /open menu/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("states plainly that the demo screens are not live data", () => {
    renderPage(<Landing />);
    expect(screen.getByText(/sample data, not a live account/i)).toBeInTheDocument();
  });

  it("carries the practitioner disclaimer in the footer", () => {
    renderPage(<Landing />);
    expect(
      screen.getByText(/does not\s+diagnose, treat or replace medical advice/i),
    ).toBeInTheDocument();
  });
});

describe("the contact form", () => {
  it("reports field errors without navigating away", async () => {
    const user = userEvent.setup();
    renderPage(<Landing />);

    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(await screen.findByText(/tell us who you are/i)).toBeInTheDocument();
    expect(screen.getByText(/we need somewhere to reply/i)).toBeInTheDocument();
  });

  it("clears a field's error as soon as it is corrected", async () => {
    const user = userEvent.setup();
    renderPage(<Landing />);

    await user.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByText(/tell us who you are/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/your name/i), "Ananya");

    expect(screen.queryByText(/tell us who you are/i)).not.toBeInTheDocument();
  });
});
