// Footer. Links point only at destinations that exist — the two auth routes
// and the page's own anchors — so nothing here 404s.

import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/ui/logo";

const COLUMNS = [
  {
    heading: "Platform",
    links: [
      { label: "Care", href: "#care" },
      { label: "AI Assistant", href: "#assistant" },
      { label: "Community", href: "#community" },
      { label: "For doctors", href: "#doctors" },
    ],
  },
];

export const LandingFooter = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-gradient-cream">
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo size="md" alt="Prakriva" />
            <p className="mt-5 text-sm leading-relaxed text-foreground/60">
              Ayurvedic wisdom, modern models, and a doctor who reads both. Built for women's
              health from the first screening to the everyday plan.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="mb-4 text-xs uppercase tracking-[0.18em] text-foreground/45">
                {column.heading}
              </h2>
              <ul className="space-y-3 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-foreground/70 transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="mb-4 text-xs uppercase tracking-[0.18em] text-foreground/45">
              Get started
            </h2>
            <ul className="space-y-3 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/auth/patient")}
                  className="text-foreground/70 transition-colors hover:text-foreground"
                >
                  Patient sign in
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate("/auth/doctor")}
                  className="text-foreground/70 transition-colors hover:text-foreground"
                >
                  Practitioner sign in
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-border/60 pt-8 text-xs text-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Prakriva. All rights reserved.</p>
          <p className="max-w-md sm:text-right">
            Prakriva supports your care — it does not replace a consultation with a qualified
            clinician.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
