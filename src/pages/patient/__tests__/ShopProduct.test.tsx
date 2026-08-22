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
    const row = badge.closest("li")!;
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

describe("comparing on speed as well as price", () => {
  it("names each seller's delivery on its own row", () => {
    // baby-water-wipes carries Amazon, FirstCry, Flipkart, Blinkit and
    // Instamart, so both kinds of storefront are on the page at once.
    renderProduct("baby-water-wipes");

    const blinkit = screen.getByText("Blinkit").closest("li")!;
    expect(within(blinkit).getByText("In 10–15 min")).toBeInTheDocument();

    const amazon = screen.getByText("Amazon").closest("li")!;
    expect(within(amazon).getByText("1–3 days")).toBeInTheDocument();
  });

  it("calls out the soonest listing as well as the cheapest", () => {
    renderProduct("baby-water-wipes");
    // FirstCry at ₹519 is cheapest; the ten-minute apps are dearer and still
    // the right answer for someone who has run out tonight.
    expect(screen.getByText("Lowest price").closest("li")).toContainElement(
      screen.getByText("FirstCry"),
    );
    expect(screen.getByText("Fastest").closest("li")).toContainElement(
      screen.getByText("Blinkit"),
    );
  });

  it("links out to Blinkit and Instamart with the same safety as Amazon", () => {
    renderProduct("baby-water-wipes");
    const hosts = outboundLinks().map((a) => new URL(a.getAttribute("href")!).hostname);
    expect(hosts).toContain("blinkit.com");
    expect(hosts).toContain("www.swiggy.com");
    for (const link of outboundLinks()) {
      expect(link.getAttribute("target")).toBe("_blank");
      for (const token of ["noopener", "noreferrer", "nofollow", "sponsored"]) {
        expect(link.getAttribute("rel")).toContain(token);
      }
    }
  });

  it("says nothing about minutes on a product no app carries", () => {
    renderProduct("mon-bp-monitor");
    expect(screen.queryByText("Fastest")).not.toBeInTheDocument();
    expect(screen.queryByText("In minutes")).not.toBeInTheDocument();
  });
});

describe("the product photograph", () => {
  it("shows the item and loads it eagerly, since it is above the fold", () => {
    renderProduct("move-yoga-mat");
    const hero = screen.getAllByRole("img")[0];
    expect(hero).toHaveAttribute("src", "/shop/move-yoga-mat.webp");
    expect(hero).toHaveAttribute("loading", "eager");
    expect(hero.getAttribute("alt")?.length ?? 0).toBeGreaterThan(15);
  });

  it("keeps the related tiles' photos lazy", () => {
    renderProduct("move-yoga-mat");
    const [, ...rest] = screen.getAllByRole("img");
    expect(rest.length).toBeGreaterThan(0);
    for (const img of rest) expect(img).toHaveAttribute("loading", "lazy");
  });
});
