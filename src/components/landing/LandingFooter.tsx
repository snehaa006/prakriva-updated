import * as React from "react";
import { Link } from "react-router-dom";

import { BrandLockup } from "./BrandMark";
import { FOOTER_COLUMNS } from "./landingContent";

/**
 * The footer.
 *
 * Anchors within the page and routes out of it are different things and are
 * rendered differently: an `href` starting with `#` stays an `<a>` so the
 * browser handles the scroll, while a route goes through react-router's
 * `<Link>` so it does not reload the app. Getting this wrong is how a
 * single-page app ends up doing a full page load from its own footer.
 */
const isAnchor = (href: string) => href.startsWith("#");

export function LandingFooter() {
  const year = new Date().getFullYear();

  // Solid plum rather than the `.lp-deep` gradient the sections above use: the
  // closing CTA's grass fades down into `--lp-plum-deep`, and a footer with its
  // own radial blooms would be a different shade at exactly that seam — a
  // visible line across the bottom of the page. Solid makes the join
  // disappear, which is also why there is no top border.
  return (
    <footer className="relative bg-lp-plum-deep pb-10 pt-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <BrandLockup size="md" tone="cream" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-lp-cream/50">
              Ayurvedic nutrition for pregnancy, PCOD/PCOS and everyday wellness — with a
              verified practitioner on the other side of the record.
            </p>
          </div>

          <nav aria-label="Footer" className="grid gap-8 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.heading}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-lp-petal/70">
                  {column.heading}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {isAnchor(link.href) ? (
                        <a
                          href={link.href}
                          className="text-sm text-lp-cream/55 transition-colors duration-200 ease-ios hover:text-lp-cream-hi"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.href}
                          className="text-sm text-lp-cream/55 transition-colors duration-200 ease-ios hover:text-lp-cream-hi"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-lp-cream-hi/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-lp-cream/40">
            © {year} Prakriva. Ayurvedic guidance, practitioner-reviewed.
          </p>
          {/* Said plainly, in the place a disclaimer belongs, rather than
              buried in a policy nobody opens. */}
          <p className="max-w-md text-xs leading-relaxed text-lp-cream/40">
            Prakriva supports care from a registered practitioner. It does not diagnose,
            treat or replace medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;
