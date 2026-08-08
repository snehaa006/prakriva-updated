import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Home, ShoppingCart, Refrigerator, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PatientPicker } from "@/components/patients/PatientPicker";
import { fetchPantryItems, type PantryItem } from "@/services/pantryService";
import { usePersistentState } from "@/hooks/usePersistentState";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/localCache";

interface PatientPantryPanelProps {
  /** Push the chosen ingredients into the recipe search. */
  onUseIngredients: (ingredientNames: string[]) => void;
}

const pantryCacheKey = (patientId: string) => `pantry:${patientId}`;

/**
 * The term the recipe API is queried with. Patients pick from the ingredient
 * catalogue, so this is a plain noun ("rice") rather than their label ("Brown
 * rice"); pantry rows written before the catalogue fall back to their name.
 */
const searchTerm = (item: PantryItem) =>
  (item.searchTerm || item.foodName).trim().toLowerCase();

/**
 * Doctor-side view of what a patient actually has in their kitchen, so recipes
 * can be searched against ingredients they already own.
 */
export const PatientPantryPanel: React.FC<PatientPantryPanelProps> = ({
  onUseIngredients,
}) => {
  const [selection, setSelection] = usePersistentState<{
    id: string;
    code: string;
    name: string;
  } | null>(CACHE_KEYS.foodExplorerPantryPatient, null);

  const patientId = selection?.id ?? "";

  // Which pantry foods to search on. The recipe API requires a recipe to
  // contain *every* ingredient listed, so sending a whole pantry reliably
  // matches nothing — the doctor picks one or two instead.
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    setChosen([]);
  }, [patientId]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pantry", patientId],
    queryFn: async () => {
      const rows = await fetchPantryItems(patientId);
      writeCache(pantryCacheKey(patientId), rows);
      return rows;
    },
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
    initialData: () =>
      patientId
        ? readCache<PantryItem[]>(pantryCacheKey(patientId)) ?? undefined
        : undefined,
    // Treat the cached copy as already stale so it paints instantly but is
    // still refreshed from Supabase on mount.
    initialDataUpdatedAt: 0,
  });

  const atHome = items.filter((item) => item.availability === "at_home");
  const toBuy = items.filter((item) => item.availability === "to_buy");

  const toggle = (item: PantryItem) => {
    const term = searchTerm(item);
    setChosen((current) =>
      current.includes(term)
        ? current.filter((entry) => entry !== term)
        : [...current, term]
    );
  };

  const ItemList: React.FC<{ list: PantryItem[]; empty: string }> = ({
    list,
    empty,
  }) =>
    list.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {list.map((item) => {
          const picked = chosen.includes(searchTerm(item));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
                picked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/50"
              )}
            >
              {picked && <Check className="h-3 w-3" />}
              {item.foodName}
              {item.quantity && (
                <span className={picked ? "opacity-80" : "text-muted-foreground"}>
                  · {item.quantity}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Refrigerator className="h-5 w-5" />
          Patient Pantry
        </CardTitle>
        <CardDescription>
          Search one of your patients to see the foods they have at home, then
          build a plan around what they can actually cook.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="max-w-md">
          <PatientPicker
            value={patientId}
            onSelect={(patient) =>
              setSelection(
                patient
                  ? { id: patient.id, code: patient.code, name: patient.name }
                  : null
              )
            }
            label="Patient"
          />
        </div>

        {!patientId && (
          <p className="text-sm text-muted-foreground">No patient selected.</p>
        )}

        {patientId && isLoading && items.length === 0 && (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {patientId && (!isLoading || items.length > 0) && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {selection?.code}
              </Badge>
              <span className="text-sm font-medium">{selection?.name}</span>
              <Badge variant="outline" className="text-xs">
                {items.length} item{items.length === 1 ? "" : "s"}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Home className="h-3 w-3" />
                  At home ({atHome.length})
                </p>
                <ItemList
                  list={atHome}
                  empty="This patient hasn't listed anything at home yet."
                />
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ShoppingCart className="h-3 w-3" />
                  Planning to buy ({toBuy.length})
                </p>
                <ItemList list={toBuy} empty="Nothing on their shopping list." />
              </div>
            </div>

            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Tap the foods to search on. A recipe has to contain{" "}
                  <strong>every</strong> ingredient you pick, so one or two gives
                  the best results.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={chosen.length === 0}
                    onClick={() => onUseIngredients(chosen)}
                  >
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                    {chosen.length === 0
                      ? "Pick a food to search"
                      : `Find recipes with ${chosen.length} selected`}
                  </Button>
                  {chosen.length > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setChosen([])}>
                      Clear selection
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientPantryPanel;
