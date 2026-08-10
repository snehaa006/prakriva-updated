// Floating glass navbar for the marketing page.
//
// It is a floating pill rather than a full-width bar so the hero's colour
// field runs edge to edge behind it. The pill only grows its shadow once the
// page has scrolled — at the top it should feel like it is resting on the
// gradient, not sitting in a tray.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Care", href: "#care" },
  { label: "AI Assistant", href: "#assistant" },
  { label: "Community", href: "#community" },
  { label: "For Doctors", href: "#doctors" },
];

export const LandingNav = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-6">
      <nav
        className={cn(
          "glass-panel mx-auto flex max-w-5xl items-center gap-3 rounded-full px-4 py-2.5 transition-all duration-500 sm:px-5",
          scrolled ? "shadow-[0_10px_40px_-16px_hsl(345_45%_30%/0.4)]" : "shadow-none"
        )}
      >
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Prakriva — back to top"
        >
          <Logo size="sm" className="h-8" alt="" />
        </button>

        <ul className="mx-auto hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-full px-3.5 py-2 text-sm text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button
            variant="ghost"
            className="hidden rounded-full text-sm text-foreground/80 hover:bg-foreground/5 sm:inline-flex"
            onClick={() => navigate("/auth/patient")}
          >
            Sign in
          </Button>
          <Button
            className="rounded-full bg-gradient-rose px-5 text-sm text-white shadow-sm transition-transform hover:scale-[1.03] hover:opacity-95"
            onClick={() => navigate("/auth/patient")}
          >
            Get started
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {open && (
        <div className="glass-panel mx-auto mt-2 max-w-5xl animate-fade-in rounded-3xl p-3 md:hidden">
          <ul className="flex flex-col">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => navigate("/auth/doctor")}
                className="block w-full rounded-2xl px-4 py-3 text-left text-sm text-foreground/80 transition-colors hover:bg-foreground/5"
              >
                I'm a doctor
              </button>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};

export default LandingNav;
