import { useQuery } from "@tanstack/react-query";
import {
  loadIngredientCatalog,
  fallbackCatalog,
  type IngredientCatalog,
} from "@/services/ingredientCatalogService";

/**
 * The ingredient vocabulary a pantry is built from, taken from the recipe API
 * (see ingredientCatalogService). Cached hard: the list changes about never,
 * and building it costs a sweep of the API's ingredient categories.
 */
export function useIngredientCatalog() {
  const query = useQuery<IngredientCatalog>({
    queryKey: ["ingredient-catalog"],
    queryFn: () => loadIngredientCatalog(),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    // Never leave the picker empty while the sweep runs — the bundled list is
    // shown immediately and replaced once the API answers.
    placeholderData: fallbackCatalog,
  });

  const catalog = query.data ?? fallbackCatalog();

  return {
    ingredients: catalog.ingredients,
    source: catalog.source,
    /** True while the API list is still loading and the bundled one is shown. */
    isLoadingCatalog: query.isFetching && catalog.source === "fallback",
    refetch: query.refetch,
  };
}

export default useIngredientCatalog;
