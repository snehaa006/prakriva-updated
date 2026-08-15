import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";

import { SHOP_CATALOGUE } from "@/data/shopCatalogue";
import { isAllowedOfferUrl } from "@/lib/shop/retailers";
import { renderPage } from "@/test/renderPage";

/**
 * The product page is the last screen before a patient leaves the app, so
 * these tests are mostly about the exit: that every seller is shown, that the
 * cheapest one is called out, and that every outbound link is https, on the
 * retailer's own host, and attributed as a sponsored link opening in a new tab.
 */

vi.mock("@/hooks/usePatientStage", () => ({
  usePatientStage: () => ({ lifeStage: "pregnancy", trimester: "2", tracks: ["pregnancy"] }),
}));

const ShopProduct = (await import("../ShopProduct")).default;

/** Render the page at a product route, the way the router mounts it. */
const renderProduct = (productId: string) =>
  renderPage(
    <Routes>
      <Route path="/patient/shop" element={<div>shop index</div>} />
      <Route path="/patient/shop/:productId" element={<ShopProduct />} />
    </Routes>,
    { route: `/patient/shop/${productId}` },
  );

const outboundLinks = () =>
  screen.queryAllByRole("link").filter((el) => /^https?:/.test(el.getAttribute("href") ?? ""));

describe("the product page", () => {
  it("shows the product, its blurb and every seller", () => {
    const product = SHOP_CATALOGUE.find((p) => p.id === "sleep-full-body-pillow")!;
    renderProduct(product.id);

    expect(screen.getByRole("heading", { level: 1, name: product.title })).toBeInTheDocument();
    expect(screen.getByText(product.blurb)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: `Compare ${product.offers.length} sellers` }),
    ).toBeInTheDocument();
    expect(outboundLinks()).toHaveLength(product.offers.length);
  });

  it("marks the cheapest in-stock listing as the lowest price", () => {
    // sleep-full-body-pillow: Amazon 1899 (in stock) is cheapest available;
    // FirstCry at 2199 is out of stock and must not win.
    renderProduct("sleep-full-body-pillow");

    const badge = screen.getByText("Lowest price");
    // The badge and the price it belongs to share a row, so assert on the row
    // rather than on the page — "₹1,899" also appears in the header summary.
    const row = badge.closest("div.flex")!.parentElement!.parentElement!;
    expect(within(row).getByText("₹1,899")).toBeInTheDocument();
    expect(within(row).getByText(/View on Amazon/)).toBeInTheDocument();
  });

  it("labels an out-of-stock seller rather than hiding it", () => {
    renderProduct("sleep-full-body-pillow");
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("shows what comparing is worth on this product", () => {
    renderProduct("sleep-full-body-pillow");
    // 2199 − 1899 = 300.
    expect(screen.getByText("₹300")).toBeInTheDocument();
  });

  it("tells her why it is relevant to her, using the dashboard's own rules", () => {
    renderProduct("sleep-full-body-pillow");
    expect(screen.getByText("Often wanted in the second trimester")).toBeInTheDocument();
  });

  it("warns before anything ingested, in full rather than as fine print", () => {
    renderProduct("supp-prenatal-multivitamin");
    expect(screen.getByText(/Check with your doctor first/i)).toBeInTheDocument();
    expect(screen.getByText(/interact/i)).toBeInTheDocument();
  });

  it("carries no such warning on a product that is not ingested", () => {
    renderProduct("sleep-full-body-pillow");
    expect(screen.queryByText(/Check with your doctor first/i)).not.toBeInTheDocument();
  });

  it("redirects a stale product link back to the shop instead of erroring", () => {
    renderProduct("no-such-product");
    expect(screen.getByText("shop index")).toBeInTheDocument();
  });
});

describe("outbound links", () => {
  it("names the destination in the button and in its accessible label", () => {
    renderProduct("sleep-full-body-pillow");
    const amazon = screen.getByRole("link", { name: /on Amazon \(opens in a new tab\)/ });
    expect(amazon).toHaveTextContent("View on Amazon");
  });

  // Every product, not just one: a single bad catalogue row is the whole risk.
  it.each(SHOP_CATALOGUE.map((p) => [p.id, p] as const))(
    "%s links out safely from every seller row",
    (_id, product) => {
      renderProduct(product.id);

      const links = outboundLinks();
      expect(links).toHaveLength(product.offers.length);

      for (const link of links) {
        const href = link.getAttribute("href")!;
        const rel = link.getAttribute("rel") ?? "";

        expect(new URL(href).protocol).toBe("https:");
        expect(link).toHaveAttribute("target", "_blank");
        // noopener/noreferrer close the window.opener hole; nofollow/sponsored
        // declare these for what they are.
        for (const token of ["noopener", "noreferrer", "nofollow", "sponsored"]) {
          expect(rel).toContain(token);
        }
      }
    },
  );

  it("only ever points at a host the retailer is allowed to be on", () => {
    for (const product of SHOP_CATALOGUE) {
      for (const offer of product.offers) {
        if (offer.url) expect(isAllowedOfferUrl(offer.retailer, offer.url)).toBe(true);
      }
    }
  });

  it("states that Prakriva neither sells the product nor takes a cut", () => {
    renderProduct("sleep-full-body-pillow");
    expect(screen.getByText(/doesn't sell these products/i)).toBeInTheDocument();
    expect(screen.getByText(/doesn't take a cut/i)).toBeInTheDocument();
  });
});
