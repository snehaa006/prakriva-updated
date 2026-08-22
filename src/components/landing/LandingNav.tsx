import * as React from "react";
import { Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSelect";
import { cn } from "@/lib/utils";

import { BrandLockup } from "./BrandMark";
import { NAV_LINKS } from "./landingContent";

/**
 * The landing page header.
 *
 * Transparent over the hero and frosted once you scroll past it — the hero's
 * bokeh runs right up under the header, and a solid bar there would cut the
 * page in two before the visitor has read a word. The switch is a class
 * change driven by one passive scroll listener, not by re-rendering on every
 * scroll event.
 *
 * The mobile sheet is a plain absolutely-positioned panel rather than the
 * Radix `Sheet`: it holds five anchors and two buttons, it needs to close on
 * navigation, and pulling in a focus-trapping dialog for that costs more than
 * it returns. Escape and a click on a link both close it.
 */
export function LandingNav() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The open menu covers the page; Escape has to be able to dismiss it.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-ios",
        scrolled
          ? "border-b border-lp-cream-lo/50 bg-lp-cream-hi/80 backdrop-blur-xl backdrop-saturate-150"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-8"
      >
        <a
          href="#top"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-plum focus-visible:ring-offset-2"
          aria-label="Prakriva — back to top"
        >
          <BrandLockup size="sm" tone="plum" />
        </a>

        {/* Desktop links. A pill-shaped group rather than bare text, so the
            header still reads as one object over a busy hero. */}
        <ul className="hidden items-center gap-1 rounded-full border border-lp-cream-lo/50 bg-lp-cream-hi/60 px-1.5 py-1.5 backdrop-blur-md lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="block rounded-full px-4 py-1.5 text-sm font-medium text-lp-plum/80 transition-colors duration-200 ease-ios hover:bg-lp-blush/70 hover:text-lp-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-plum"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          {/* Language first, before sign-in: someone who cannot read the page
              cannot read the sign-in button either. */}
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-lp-plum hover:bg-lp-blush/70 hover:text-lp-plum sm:inline-flex"
            onClick={() => navigate("/auth/patient")}
          >
            Sign in
          </Button>
          <Button
            size="sm"
            className="hidden bg-lp-plum text-lp-cream-hi shadow-sm hover:bg-lp-plum/90 sm:inline-flex"
            onClick={() => navigate("/auth/patient")}
          >
            Get started
          </Button>

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lp-plum transition-colors duration-200 ease-ios hover:bg-lp-blush/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lp-plum lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-lp-cream-lo/50 bg-lp-cream-hi/95 backdrop-blur-xl lg:hidden">
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-3 py-3 text-base font-medium text-lp-plum transition-colors duration-200 ease-ios hover:bg-lp-blush/70"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="mt-2 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="border-lp-plum/25 text-lp-plum hover:bg-lp-blush/70"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/auth/patient");
                }}
              >
                Sign in
              </Button>
              <Button
                className="bg-lp-plum text-lp-cream-hi hover:bg-lp-plum/90"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/auth/patient");
                }}
              >
                Get started
              </Button>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

export default LandingNav;
