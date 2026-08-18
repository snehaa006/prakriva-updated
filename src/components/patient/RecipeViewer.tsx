// The recipe detail sheet, shared by Today and the plan builder.
//
// Both places show the same thing when you tap the eye on a meal, so this is a
// hook that owns the fetch, the loading overlay and the modal; a page just
// calls `open(recipeId)` and renders `element`.

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  getInstructionsByRecipeId,
  searchRecipeById,
  type RecipeBasic,
} from "@/services/foodoscopeApi";

interface RecipeViewData {
  recipe: RecipeBasic;
  instructions: string;
}

export function useRecipeViewer() {
  const [viewing, setViewing] = useState<RecipeViewData | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback(async (recipeId?: string) => {
    if (!recipeId) return;
    setLoading(true);
    try {
      const [recipeRes, instructionRes] = await Promise.all([
        searchRecipeById(recipeId).catch(() => null),
        getInstructionsByRecipeId(recipeId).catch(() => null),
      ]);
      const recipe = recipeRes?.recipe ?? null;
      if (!recipe) {
        toast.error("Recipe details not available");
        return;
      }
      setViewing({
        recipe,
        instructions:
          instructionRes?.steps?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n") ||
          "Instructions not available.",
      });
    } catch {
      toast.error("Could not load recipe details");
    } finally {
      setLoading(false);
    }
  }, []);

  const element = (
    <>
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200"
          onClick={() => setViewing(null)}
        >
          <Card
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-title3">{viewing.recipe.Recipe_title}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 shrink-0 p-0 text-foreground-tertiary sm:h-8 sm:w-8"
                  onClick={() => setViewing(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                  <span className="block text-caption1 text-foreground-secondary">Calories</span>
                  <span className="text-subhead font-semibold text-foreground">
                    {viewing.recipe.Calories || viewing.recipe["Energy (kcal)"] || "N/A"}
                  </span>
                </div>
                <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                  <span className="block text-caption1 text-foreground-secondary">Protein</span>
                  <span className="text-subhead font-semibold text-foreground">
                    {viewing.recipe["Protein (g)"] || "N/A"}g
                  </span>
                </div>
                <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                  <span className="block text-caption1 text-foreground-secondary">Region</span>
                  <span className="text-subhead font-semibold text-foreground">
                    {viewing.recipe.Region || "Global"}
                  </span>
                </div>
                <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                  <span className="block text-caption1 text-foreground-secondary">Cook time</span>
                  <span className="text-subhead font-semibold text-foreground">
                    {viewing.recipe.cook_time || viewing.recipe.total_time || "N/A"} min
                  </span>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-footnote font-semibold text-foreground">Instructions</h4>
                <div className="whitespace-pre-line rounded-xl bg-muted/50 p-3.5 text-footnote text-foreground-secondary">
                  {viewing.instructions}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-footnote text-foreground">Loading recipe details…</span>
          </div>
        </div>
      )}
    </>
  );

  return { open, element, loading };
}
