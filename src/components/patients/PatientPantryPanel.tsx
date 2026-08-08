import React from "react";
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
import { Home, ShoppingCart, Refrigerator, Search } from "lucide-react";
import { PatientPicker } from "@/components/patients/PatientPicker";
import {
  fetchPantryItems,
  pantryIngredientNames,
  type PantryItem,
} from "@/services/pantryService";
import { usePersistentState } from "@/hooks/usePersistentState";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/localCache";

interface PatientPantryPanelProps {
  /** Push the patient's ingredients into the recipe search. */
  onUseIngredients: (ingredientNames: string[]) => void;
}

const pantryCacheKey = (patientId: string) => `pantry:${patientId}`;

const ItemList: React.FC<{ items: PantryItem[]; empty: string }> = ({
  items,
  empty,
}) =>
  items.length === 0 ? (
    <p className="text-sm text-muted-foreground">{empty}</p>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item.id} variant="outline" className="gap-1 text-xs capitalize">
          {item.foodName}
          {item.quantity && (
            <span className="text-muted-foreground">· {item.quantity}</span>
          )}
        </Badge>
      ))}
    </div>
  );

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
          <p className="text-sm text-muted-foreground">
            No patient selected.
          </p>
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
                  items={atHome}
                  empty="This patient hasn't listed anything at home yet."
                />
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ShoppingCart className="h-3 w-3" />
                  Planning to buy ({toBuy.length})
                </p>
                <ItemList items={toBuy} empty="Nothing on their shopping list." />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={atHome.length === 0}
                onClick={() => onUseIngredients(pantryIngredientNames(atHome))}
              >
                <Search className="mr-1.5 h-3.5 w-3.5" />
                Find recipes from what they have
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={items.length === 0}
                onClick={() => onUseIngredients(pantryIngredientNames(items))}
              >
                Include shopping list too
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PatientPantryPanel;
