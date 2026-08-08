// src/pages/patient/Pantry.tsx
// "My Kitchen" — the patient records what food they already have at home and
// what they plan to buy. Their doctor reads this from the Food Explorer, so
// plans can be built around what is actually available.

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
import {
  ingredientsByCategory,
  ingredientSearchValue,
  type IngredientOption,
} from "@/data/ingredients";
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
  <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium capitalize">{item.foodName}</p>
        {item.quantity && (
          <span className="text-xs text-muted-foreground">{item.quantity}</span>
        )}
      </div>
      {item.notes && (
        <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>
      )}
    </div>

    <div className="flex shrink-0 gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={busy}
        title={
          item.availability === "at_home"
            ? "Move to shopping list"
            : "I have this at home now"
        }
        onClick={() => onToggle(item)}
      >
        <ArrowRightLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={busy}
        title="Remove"
        onClick={() => onDelete(item)}
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  </div>
);

const Pantry: React.FC = () => {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const patientId = user?.id ?? "";

  const [ingredient, setIngredient] = useState<IngredientOption | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  // Grouped once — the catalogue is static.
  const ingredientGroups = useMemo(() => ingredientsByCategory(), []);

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
      return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
    }
    return (
      <div className="space-y-2">
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
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
          <Refrigerator className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Kitchen</h1>
          <p className="text-sm text-muted-foreground">
            List the foods you have at home and the ones you plan to buy — your
            doctor uses this to build a plan you can actually cook.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not load your kitchen list: {(error as Error).message}
        </p>
      )}

      {/* Add form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Add a food</CardTitle>
          <CardDescription>
            Search the food list — grains, dals, vegetables, fruits, spices,
            dairy. Picking from the list is what lets your doctor find recipes
            that use it.
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
                  <Command
                    filter={(itemValue, search) =>
                      itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Type a food, e.g. rice or methi…" />
                    <CommandList>
                      <CommandEmpty>
                        No matching food. Try a simpler name — "rice" rather
                        than a dish name.
                      </CommandEmpty>
                      {ingredientGroups.map((group) => (
                        <CommandGroup key={group.category} heading={group.category}>
                          {group.options.map((option) => (
                            <CommandItem
                              key={option.label}
                              value={ingredientSearchValue(option)}
                              onSelect={() => {
                                setIngredient(option);
                                setPickerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  ingredient?.label === option.label
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
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
            <CardTitle className="text-base">Your foods</CardTitle>
            <div className="relative sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
            <TabsList className="mb-4">
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

export default Pantry;
