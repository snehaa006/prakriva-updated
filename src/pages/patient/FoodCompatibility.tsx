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
    <div className="flex-1 flex flex-col p-6 gap-4 h-full">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Utensils className="w-7 h-7" />
          Food Compatibility
        </h1>
        <p className="text-muted-foreground">
          Check Ayurvedic food-combination compatibility (viruddha ahara) — add
          the foods in a meal and see which pairings clash and why.
        </p>
      </div>

      <div className="flex-1 min-h-[70vh] rounded-lg border overflow-hidden bg-white">
        <iframe
          src="/mealCompatibility.html"
          title="Food Compatibility Intelligence Engine"
          className="w-full h-full min-h-[70vh]"
        />
      </div>
    </div>
  );
};

export default FoodCompatibility;
