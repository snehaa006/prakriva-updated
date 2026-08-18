// "My Kitchen" — the patient records what food they already have at home and
// what they plan to buy. Their doctor reads this from the Food Explorer, so
// plans can be built around what is actually available.
//
// This was its own page filed under "More"; it is now a panel inside the plan
// hub, a tab away from the plan she is cooking from. Keeping it a component
// rather than a page is what lets it sit there without a second page header
// restating what the tab above it already says.

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Home,
  ShoppingCart,
  Plus,
  Trash2,
  Search,
  Loader2,
  ArrowRightLeft,
  Refrigerator,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIngredientCatalog } from "@/hooks/useIngredientCatalog";
import {
  catalogSearchValue,
  type CatalogIngredient,
} from "@/services/ingredientCatalogService";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import {
  addPantryItem,
  deletePantryItem,
  fetchPantryItems,
  updatePantryItem,
  type PantryAvailability,
  type PantryItem,
} from "@/services/pantryService";
import { readCache, writeCache } from "@/lib/localCache";

const pantryCacheKey = (patientId: string) => `pantry:${patientId}`;
export const pantryQueryKey = (patientId: string) => ["pantry", patientId];

const AVAILABILITY_LABEL: Record<PantryAvailability, string> = {
  at_home: "At home",
  to_buy: "To buy",
};

const PantryItemCard: React.FC<{
  item: PantryItem;
  onToggle: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
  busy: boolean;
}> = ({ item, onToggle, onDelete, busy }) => (
  <div className="flex items-start justify-between gap-2 rounded-2xl border border-border bg-card p-3.5 transition-shadow hover:shadow-xs sm:gap-3 sm:p-4">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-subhead font-medium capitalize text-foreground">{item.foodName}</p>
        {item.quantity && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-caption2 text-foreground-secondary">
            {item.quantity}
          </span>
        )}
      </div>
      {item.notes && (
        <p className="mt-1 text-caption1 text-foreground-tertiary">{item.notes}</p>
      )}
    </div>

    <div className="flex shrink-0 gap-0.5 sm:gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        disabled={busy}
        title={
          item.availability === "at_home"
            ? "Move to shopping list"
            : "I have this at home now"
        }
        onClick={() => onToggle(item)}
      >
        <ArrowRightLeft className="h-4 w-4 text-foreground-secondary" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        disabled={busy}
        title="Remove"
        onClick={() => onDelete(item)}
      >
        <Trash2 className="h-4 w-4 text-foreground-tertiary" />
      </Button>
    </div>
  </div>
);

export const PantryPanel: React.FC = () => {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const patientId = user?.id ?? "";

  const [ingredient, setIngredient] = useState<CatalogIngredient | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [foodQuery, setFoodQuery] = useState("");
  const [quantity, setQuantity] = useState("");
  const [availability, setAvailability] = useState<PantryAvailability>("at_home");
  const [notes, setNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PantryItem | null>(null);
  const [search, setSearch] = useState("");

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: pantryQueryKey(patientId),
    queryFn: async () => {
      const rows = await fetchPantryItems(patientId);
      // Mirror to localStorage so a refresh paints instantly instead of blank.
      writeCache(pantryCacheKey(patientId), rows);
      return rows;
    },
    enabled: !!patientId,
    // The pantry only changes when this patient edits it, so serve it from
    // cache and keep the last known list through a page refresh.
    staleTime: 5 * 60 * 1000,
    initialData: () =>
      patientId ? readCache<PantryItem[]>(pantryCacheKey(patientId)) ?? undefined : undefined,
    // Treat the cached copy as already stale so it paints instantly but is
    // still refreshed from Supabase on mount.
    initialDataUpdatedAt: 0,
  });

  const setItems = (next: PantryItem[]) => {
    queryClient.setQueryData(pantryQueryKey(patientId), next);
    writeCache(pantryCacheKey(patientId), next);
  };

  // The ingredient vocabulary comes from the recipe API, so anything a patient
  // can pick is something the doctor's recipe search can actually match.
  const { ingredients: catalog, source: catalogSource, isLoadingCatalog } =
    useIngredientCatalog();

  // cmdk's own filter would render every one of ~1000 entries; rank and cap
  // them instead. The catalogue arrives sorted by how many recipes use each
  // ingredient, so an empty query already shows the common foods first.
  const matches = useMemo(() => {
    const term = foodQuery.trim().toLowerCase();
    if (!term) return catalog.slice(0, 60);

    const scored: { entry: CatalogIngredient; score: number }[] = [];
    for (const entry of catalog) {
      const label = entry.label.toLowerCase();
      let score = 0;
      if (label.startsWith(term)) score = 3;
      else if (label.includes(term)) score = 2;
      else if (catalogSearchValue(entry).toLowerCase().includes(term)) score = 1;
      if (score > 0) scored.push({ entry, score });
    }

    return scored
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.entry.frequency - a.entry.frequency ||
          a.entry.label.localeCompare(b.entry.label)
      )
      .slice(0, 60)
      .map((match) => match.entry);
  }, [catalog, foodQuery]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => item.foodName.toLowerCase().includes(term));
  }, [items, search]);

  const atHome = filtered.filter((item) => item.availability === "at_home");
  const toBuy = filtered.filter((item) => item.availability === "to_buy");

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patientId) return;

    if (!ingredient) {
      toast.error("Pick a food from the list first.");
      return;
    }
    const name = ingredient.label;

    const duplicate = items.find(
      (item) =>
        item.foodName.toLowerCase() === name.toLowerCase() &&
        item.availability === availability
    );
    if (duplicate) {
      toast.info(`${name} is already on your ${AVAILABILITY_LABEL[availability].toLowerCase()} list.`);
      return;
    }

    setIsAdding(true);
    try {
      const created = await addPantryItem(patientId, {
        foodName: name,
        searchTerm: ingredient.searchTerm,
        category: ingredient.category,
        quantity,
        availability,
        notes,
      });
      setItems([created, ...items]);
      setIngredient(null);
      setFoodQuery("");
      setQuantity("");
      setNotes("");
      toast.success(`${created.foodName} added to your ${AVAILABILITY_LABEL[created.availability].toLowerCase()} list.`);
    } catch (err) {
      console.error("Error adding pantry item:", err);
      toast.error(err instanceof Error ? err.message : "Could not add the item.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (item: PantryItem) => {
    const next: PantryAvailability =
      item.availability === "at_home" ? "to_buy" : "at_home";
    setBusyItemId(item.id);
    try {
      const updated = await updatePantryItem(item.id, { availability: next });
      setItems(items.map((row) => (row.id === item.id ? updated : row)));
      toast.success(`Moved to ${AVAILABILITY_LABEL[next].toLowerCase()}.`);
    } catch (err) {
      console.error("Error updating pantry item:", err);
      toast.error(err instanceof Error ? err.message : "Could not move the item.");
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDelete = async (item: PantryItem) => {
    setBusyItemId(item.id);
    try {
      await deletePantryItem(item.id);
      setItems(items.filter((row) => row.id !== item.id));
      toast.success(`${item.foodName} removed.`);
    } catch (err) {
      console.error("Error deleting pantry item:", err);
      toast.error(err instanceof Error ? err.message : "Could not remove the item.");
    } finally {
      setBusyItemId(null);
      setPendingDelete(null);
    }
  };

  const renderList = (list: PantryItem[], empty: string) => {
    if (isLoading && items.length === 0) {
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-16 w-full" />
          ))}
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center py-12 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary">
            <Refrigerator className="h-5 w-5" />
          </span>
          <p className="mt-3 text-footnote text-foreground-secondary">{empty}</p>
        </div>
      );
    }
    return (
      <div className="space-y-2.5">
        {list.map((item) => (
          <PantryItemCard
            key={item.id}
            item={item}
            busy={busyItemId === item.id}
            onToggle={handleToggle}
            onDelete={setPendingDelete}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <p className="text-footnote text-foreground-secondary">
        List the foods you have at home and the ones you plan to buy — your
        doctor uses this to build a plan you can actually cook.
      </p>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-footnote text-destructive">
          Could not load your kitchen list: {(error as Error).message}
        </p>
      )}

      {/* Add form — the primary action on this page */}
      <Card className="border-primary/15 bg-accent-soft/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-headline">Add a food</CardTitle>
          <CardDescription>
            Search the food list — grains, dals, vegetables, fruits, spices,
            dairy. The list is every ingredient the recipe database knows, so
            whatever you pick, your doctor can find recipes that use it.
            {catalogSource === "fallback" && !isLoadingCatalog && (
              <span className="mt-1 block text-warning">
                Showing the offline food list — the full one will load when the
                connection is back.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <Label>Food</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="mt-1 w-full justify-between font-normal"
                  >
                    {ingredient ? (
                      <span className="truncate">{ingredient.label}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Search all foods…
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={foodQuery}
                      onValueChange={setFoodQuery}
                      placeholder="Type a food, e.g. rice or methi…"
                    />
                    <CommandList>
                      <CommandEmpty>
                        {isLoadingCatalog
                          ? "Loading the food list…"
                          : "No matching food. Try a simpler name — \"rice\" rather than a dish name."}
                      </CommandEmpty>
                      <CommandGroup
                        heading={foodQuery.trim() ? "Matches" : "Most used foods"}
                      >
                        {matches.map((option) => (
                          <CommandItem
                            key={option.searchTerm}
                            value={option.searchTerm}
                            onSelect={() => {
                              setIngredient(option);
                              setPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                ingredient?.searchTerm === option.searchTerm
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <span className="flex-1 truncate">{option.label}</span>
                            <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                              {option.category}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="md:col-span-4">
              <Label htmlFor="pantry-quantity">Quantity</Label>
              <Input
                id="pantry-quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="e.g. 2 kg"
                className="mt-1"
              />
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="pantry-availability">List</Label>
              <Select
                value={availability}
                onValueChange={(value) => setAvailability(value as PantryAvailability)}
              >
                <SelectTrigger id="pantry-availability" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="at_home">Available at home</SelectItem>
                  <SelectItem value="to_buy">Planning to buy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-9">
              <Label htmlFor="pantry-notes">Notes (optional)</Label>
              <Textarea
                id="pantry-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="e.g. Organic, expires next month"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex items-end md:col-span-3">
              <Button
                type="submit"
                disabled={isAdding || !patientId || !ingredient}
                className="w-full"
              >
                {isAdding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add food
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lists */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-headline">Your foods</CardTitle>
            <div className="relative sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-foreground-tertiary" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter your list…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="at_home">
            <TabsList className="mb-5">
              <TabsTrigger value="at_home" className="gap-1.5">
                <Home className="h-3.5 w-3.5" />
                At home ({atHome.length})
              </TabsTrigger>
              <TabsTrigger value="to_buy" className="gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" />
                Shopping list ({toBuy.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="at_home">
              {renderList(atHome, "Nothing added yet. Add the foods you keep at home.")}
            </TabsContent>
            <TabsContent value="to_buy">
              {renderList(toBuy, "Your shopping list is empty.")}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.foodName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This takes it off your kitchen list. You can add it back any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && handleDelete(pendingDelete)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PantryPanel;
