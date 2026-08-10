import { Utensils } from "lucide-react";

/**
 * Food Compatibility checker.
 *
 * The tool itself is the self-contained `public/mealCompatibility.html`
 * ("Food Compatibility Intelligence Engine" — Ayurvedic viruddha ahara, the
 * rules for incompatible food combinations). It predates the React app and has
 * no dependency on it, so rather than port ~2000 lines we surface it in-app in
 * an iframe, keeping the sidebar and layout around it. Vercel serves the file
 * from `public/` directly, so the catch-all SPA rewrite does not shadow it.
 */
const FoodCompatibility = () => {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 gap-4 sm:gap-6 h-full max-w-6xl mx-auto w-full">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
          <Utensils className="w-5 h-5 sm:w-6 sm:h-6" />
        </span>
        <div>
          <h1 className="text-title1 text-foreground">Food Compatibility</h1>
          <p className="mt-1.5 text-body text-foreground-secondary max-w-xl">
            Check Ayurvedic food-combination compatibility (viruddha ahara) —
            add the foods in a meal and see which pairings clash and why.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-[60vh] sm:min-h-[70vh] rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        <iframe
          src="/mealCompatibility.html"
          title="Food Compatibility Intelligence Engine"
          className="w-full h-full min-h-[60vh] sm:min-h-[70vh]"
        />
      </div>
    </div>
  );
};

export default FoodCompatibility;
