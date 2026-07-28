// src/pages/doctor/FoodExplorer.tsx
import React, { useState, useCallback, useEffect } from "react";
import { useFoodContext, Food } from "@/context/FoodContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Minus,
  Search,
  Filter,
  ShoppingCart,
  Utensils,
  Leaf,
  Award,
  Info,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  MapPin,
  Globe,
  Flame,
  Star,
  Eye,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getRecipesInfo,
  getRecipeOfDay,
  getRecipeByTitle,
  getRecipesByCalories,
  getRecipesByProtein,
  getRecipesByCarbs,
  getRecipesByEnergy,
  getRecipesByCuisine,
  getRecipesByDiet,
  getRecipesByRegionAndDiet,
  getRecipesByCookingMethod,
  getRecipesByUtensils,
  getRecipesByCategory,
  getRecipesByIngredientsCategoriesTitle,
  searchRecipeById,
  getInstructionsByRecipeId,
  getNutritionInfo,
  getMicronutritionInfo,
  getIngredientsByFlavor,
  getRecipeDayByCategory,
  RecipeBasic,
  RecipeOfDay,
} from "@/services/foodoscopeApi";

// --- Constants ---

const ITEMS_PER_PAGE = 12;

const DIET_OPTIONS = [
  { value: "all", label: "All Diets" },
  { value: "vegan", label: "Vegan" },
  { value: "pescetarian", label: "Pescetarian" },
  { value: "ovo_vegetarian", label: "Ovo-Vegetarian" },
  { value: "lacto_vegetarian", label: "Lacto-Vegetarian" },
  { value: "ovo_lacto_vegetarian", label: "Ovo-Lacto Vegetarian" },
];

const COOKING_METHODS = [
  { value: "", label: "All Methods" },
  { value: "cook", label: "Cook" },
  { value: "bake", label: "Bake" },
  { value: "fry", label: "Fry" },
  { value: "boil", label: "Boil" },
  { value: "grill", label: "Grill" },
  { value: "roast", label: "Roast" },
  { value: "steam", label: "Steam" },
  { value: "stir", label: "Stir" },
  { value: "simmer", label: "Simmer" },
  { value: "blend", label: "Blend" },
];

const REGION_OPTIONS = [
  "All",
  "Indian Subcontinent",
  "Middle Eastern",
  "Italian",
  "UK",
  "Greek",
  "French",
  "Chinese",
  "Japanese",
  "Thai",
  "Mexican",
  "Spanish",
  "German",
  "Korean",
  "Vietnamese",
  "Turkish",
  "Australian",
  "Irish",
  "Belgian",
  "Northern Africa",
  "South American",
];

const FLAVOR_CATEGORIES = [
  { value: "", label: "Select Flavor" },
  { value: "Vegetable-Bulb", label: "Vegetable-Bulb" },
  { value: "Vegetable-Root", label: "Vegetable-Root" },
  { value: "Vegetable-Fruit", label: "Vegetable-Fruit" },
  { value: "Vegetable-Tuber", label: "Vegetable-Tuber" },
  { value: "Fruit", label: "Fruit" },
  { value: "Spice", label: "Spice" },
  { value: "Herb", label: "Herb" },
  { value: "Nut", label: "Nut" },
  { value: "Cereal", label: "Cereal" },
  { value: "Dairy", label: "Dairy" },
  { value: "Meat", label: "Meat" },
  { value: "Seafood", label: "Seafood" },
];

// --- Helpers ---

function recipeToFood(recipe: RecipeBasic): Food {
  const isVegan = parseFloat(recipe.vegan || "0") === 1;
  const isLactoVeg = parseFloat(recipe.lacto_vegetarian || "0") === 1;
  const isOvoLactoVeg = parseFloat(recipe.ovo_lacto_vegetarian || "0") === 1;
  const isOvoVeg = parseFloat(recipe.ovo_vegetarian || "0") === 1;
  const isVegetarian = isVegan || isLactoVeg || isOvoLactoVeg || isOvoVeg;

  return {
    id: recipe.Recipe_id || recipe._id,
    Food_Item: recipe.Recipe_title,
    Category: recipe.Region || "Unknown",
    Calories: Number(recipe.Calories) || 0,
    Protein: Number(recipe["Protein (g)"]) || 0,
    Carbs: Number(recipe["Carbohydrate, by difference (g)"]) || 0,
    Fat: Number(recipe["Total lipid (fat) (g)"]) || 0,
    Vegetarian: isVegetarian ? "Yes" : "No",
    Vegan: isVegan ? "Yes" : "No",
    Dosha_Vata: "Neutral",
    Dosha_Pitta: "Neutral",
    Dosha_Kapha: "Neutral",
    Food_Group: recipe.Continent || "General",
  };
}

function getDietBadges(recipe: RecipeBasic) {
  const badges: { label: string; color: string }[] = [];
  if (parseFloat(recipe.vegan || "0") === 1)
    badges.push({ label: "Vegan", color: "bg-green-100 text-green-800" });
  if (parseFloat(recipe.lacto_vegetarian || "0") === 1)
    badges.push({ label: "Lacto-Veg", color: "bg-emerald-100 text-emerald-800" });
  if (parseFloat(recipe.ovo_vegetarian || "0") === 1)
    badges.push({ label: "Ovo-Veg", color: "bg-teal-100 text-teal-800" });
  if (parseFloat(recipe.ovo_lacto_vegetarian || "0") === 1)
    badges.push({ label: "Ovo-Lacto", color: "bg-cyan-100 text-cyan-800" });
  if (parseFloat(recipe.pescetarian || "0") === 1)
    badges.push({ label: "Pescetarian", color: "bg-blue-100 text-blue-800" });
  return badges;
}

function formatNumber(val: string | number | undefined): string {
  const n = Number(val);
  if (isNaN(n)) return "—";
  return n > 1000 ? n.toFixed(0) : n.toFixed(1);
}

// --- Sub-Components ---

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
        <Card key={i} className="h-full">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
                <Skeleton className="h-4" />
              </div>
              <Skeleton className="h-9 w-full mt-4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
      >
        <ChevronsLeft className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      {getPageNumbers().map((p, idx) =>
        typeof p === "string" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(p)}
            className="min-w-[36px]"
          >
            {p}
          </Button>
        )
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
      >
        <ChevronsRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// --- Recipe Detail Modal ---

function RecipeDetailModal({
  recipeId,
  open,
  onClose,
}: {
  recipeId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: recipeData, isLoading: loadingRecipe } = useQuery({
    queryKey: ["recipe-detail", recipeId],
    queryFn: () => searchRecipeById(recipeId!),
    enabled: !!recipeId && open,
    retry: (failureCount, error) => {
      if (error?.message?.includes("429")) return false;
      return failureCount < 2;
    },
  });

  const { data: instructionsData, isLoading: loadingInstructions } = useQuery({
    queryKey: ["recipe-instructions", recipeId],
    queryFn: () => getInstructionsByRecipeId(recipeId!),
    enabled: !!recipeId && open,
    retry: (failureCount, error) => {
      if (error?.message?.includes("429")) return false;
      return failureCount < 2;
    },
  });

  const recipe = recipeData?.recipe;
  const ingredients = recipeData?.ingredients || [];
  const steps = instructionsData?.steps || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {loadingRecipe ? (
              <Skeleton className="h-6 w-2/3" />
            ) : (
              recipe?.Recipe_title || "Recipe Details"
            )}
          </DialogTitle>
          <DialogDescription>
            {recipe && (
              <span className="flex items-center gap-2 mt-1">
                <MapPin className="w-3 h-3" />
                {recipe.Region}
                {recipe.Sub_region && recipe.Sub_region !== recipe.Region && ` / ${recipe.Sub_region}`}
                <span className="mx-1">|</span>
                <Globe className="w-3 h-3" />
                {recipe.Continent}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loadingRecipe ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : recipe ? (
          <Tabs defaultValue="overview" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ingredients">
                Ingredients ({ingredients.length})
              </TabsTrigger>
              <TabsTrigger value="instructions">Instructions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Time & Serving Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Prep Time</p>
                    <p className="font-medium text-sm">
                      {recipe.prep_time || "—"} min
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50">
                  <Flame className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cook Time</p>
                    <p className="font-medium text-sm">
                      {recipe.cook_time || "—"} min
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Time</p>
                    <p className="font-medium text-sm">
                      {recipe.total_time || "—"} min
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50">
                  <Users className="w-4 h-4 text-purple-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Servings</p>
                    <p className="font-medium text-sm">
                      {recipe.servings || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Macronutrients */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Nutrition per Serving</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-amber-50">
                      <p className="text-xl font-bold text-amber-700">
                        {formatNumber(recipe.Calories)}
                      </p>
                      <p className="text-xs text-muted-foreground">Calories</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50">
                      <p className="text-xl font-bold text-green-700">
                        {formatNumber(recipe["Protein (g)"])}g
                      </p>
                      <p className="text-xs text-muted-foreground">Protein</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-50">
                      <p className="text-xl font-bold text-blue-700">
                        {formatNumber(recipe["Carbohydrate, by difference (g)"])}g
                      </p>
                      <p className="text-xs text-muted-foreground">Carbs</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-rose-50">
                      <p className="text-xl font-bold text-rose-700">
                        {formatNumber(recipe["Total lipid (fat) (g)"])}g
                      </p>
                      <p className="text-xs text-muted-foreground">Fat</p>
                    </div>
                  </div>
                  {recipe["Energy (kcal)"] && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Total Energy: {formatNumber(recipe["Energy (kcal)"])} kcal
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Diet Tags */}
              <div>
                <p className="text-sm font-medium mb-2">Diet Compatibility</p>
                <div className="flex flex-wrap gap-2">
                  {getDietBadges(recipe).length > 0 ? (
                    getDietBadges(recipe).map((b) => (
                      <Badge key={b.label} className={b.color} variant="outline">
                        {b.label}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-700">
                      Non-Vegetarian
                    </Badge>
                  )}
                </div>
              </div>

              {/* Utensils & Processes */}
              {recipe.Utensils && (
                <div>
                  <p className="text-sm font-medium mb-2">Utensils Needed</p>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(recipe.Utensils.split("||"))].map((u) => (
                      <Badge key={u} variant="secondary" className="text-xs">
                        {u.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {recipe.Processes && (
                <div>
                  <p className="text-sm font-medium mb-2">Cooking Processes</p>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(recipe.Processes.split("||"))].map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {p.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {recipe.Source && (
                <p className="text-xs text-muted-foreground">
                  Source: {recipe.Source}
                </p>
              )}
            </TabsContent>

            <TabsContent value="ingredients" className="mt-4">
              {ingredients.length > 0 ? (
                <div className="space-y-2">
                  {ingredients.map((ing, idx) => (
                    <div
                      key={ing._id || idx}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {idx + 1}.
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">
                          {ing.ingredient}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ing.ingredient_Phrase}
                        </p>
                        <div className="flex gap-2 mt-1">
                          {ing.quantity && (
                            <Badge variant="outline" className="text-xs">
                              {ing.quantity} {ing.unit || ""}
                            </Badge>
                          )}
                          {ing.state && (
                            <Badge variant="secondary" className="text-xs">
                              {ing.state}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Ingredient details not available for this recipe.
                </p>
              )}
            </TabsContent>

            <TabsContent value="instructions" className="mt-4">
              {loadingInstructions ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : steps.length > 0 ? (
                <ol className="space-y-3">
                  {steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </span>
                      <p className="text-sm leading-relaxed pt-1">{step}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Step-by-step instructions not available for this recipe.
                </p>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Recipe details could not be loaded.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Recipe of the Day Component ---

function RecipeOfDayCard() {
  const { addToSelectedFoods, selectedFoods } = useFoodContext();
  const { data: rotd, isLoading } = useQuery({
    queryKey: ["recipe-of-day"],
    queryFn: getRecipeOfDay,
    staleTime: 1000 * 60 * 60, // cache 1 hour
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 429 rate limit errors
      if (error?.message?.includes("429")) return false;
      return failureCount < 2;
    },
  });

  if (isLoading) {
    return (
      <Card className="mb-6 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <Skeleton className="h-24 w-32 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!rotd) return null;

  const isAlreadySelected = selectedFoods.some(
    (f) => f.id === rotd.Recipe_id || f.Food_Item === rotd.Recipe_title
  );

  return (
    <Card className="mb-6 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          Recipe of the Day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2">{rotd.Recipe_title}</h3>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className="gap-1">
                <MapPin className="w-3 h-3" />
                {rotd.Region}
              </Badge>
              {rotd.Sub_region && rotd.Sub_region !== rotd.Region && (
                <Badge variant="secondary">{rotd.Sub_region}</Badge>
              )}
              <Badge variant="outline" className="gap-1">
                <Globe className="w-3 h-3" />
                {rotd.Continent}
              </Badge>
              {getDietBadges(rotd as unknown as RecipeBasic).map((b) => (
                <Badge key={b.label} className={b.color} variant="outline">
                  {b.label}
                </Badge>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" />
                <span className="text-muted-foreground">Cal:</span>
                <span className="font-medium">{rotd.Calories}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Protein:</span>{" "}
                <span className="font-medium">
                  {formatNumber(rotd["Protein (g)"])}g
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Carbs:</span>{" "}
                <span className="font-medium">
                  {formatNumber(rotd["Carbohydrate, by difference (g)"])}g
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Fat:</span>{" "}
                <span className="font-medium">
                  {formatNumber(rotd["Total lipid (fat) (g)"])}g
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
              {rotd.total_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {rotd.total_time} min
                </span>
              )}
              {rotd.servings && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {rotd.servings} servings
                </span>
              )}
            </div>

            {/* Instructions if available */}
            {rotd.instructions && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                {rotd.instructions}
              </p>
            )}

            {/* Ingredients if available */}
            {rotd.ingredients && rotd.ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {rotd.ingredients.map((ing) => (
                  <Badge key={ing.name} variant="secondary" className="text-xs">
                    {ing.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex sm:flex-col gap-2 sm:justify-center">
            {!isAlreadySelected ? (
              <Button
                size="sm"
                onClick={() => {
                  addToSelectedFoods(recipeToFood(rotd as unknown as RecipeBasic));
                  toast.success(`Added ${rotd.Recipe_title} to selection`);
                }}
                className="gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            ) : (
              <Button size="sm" disabled variant="secondary" className="gap-1">
                <ShoppingCart className="w-3 h-3" />
                Added
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Ingredient Flavor Explorer ---

function FlavorExplorer() {
  const [selectedFlavor, setSelectedFlavor] = useState("");
  const [flavorPage, setFlavorPage] = useState(1);

  const { data: flavorData, isLoading } = useQuery({
    queryKey: ["ingredients-flavor", selectedFlavor, flavorPage],
    queryFn: () => getIngredientsByFlavor(selectedFlavor, flavorPage, 20),
    enabled: !!selectedFlavor,
    retry: false, // FlavorDB endpoint may return 404
  });

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Leaf className="w-4 h-4" />
          Explore Ingredients by Flavor
        </CardTitle>
        <CardDescription>
          Discover ingredients grouped by their flavor profile
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 items-end mb-4">
          <div className="w-64">
            <Label>Flavor Category</Label>
            <Select
              value={selectedFlavor}
              onValueChange={(v) => {
                setSelectedFlavor(v);
                setFlavorPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select flavor..." />
              </SelectTrigger>
              <SelectContent>
                {FLAVOR_CATEGORIES.map((f) => (
                  <SelectItem key={f.value} value={f.value || "none"}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isLoading && (
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        )}
        {flavorData && flavorData.data.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              {flavorData.data.map((ing) => (
                <Badge
                  key={ing._id}
                  variant="secondary"
                  className="text-sm py-1 px-3"
                >
                  <span className="capitalize">{ing.ingredient}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({ing.generic_name})
                  </span>
                </Badge>
              ))}
            </div>
            {flavorData.pagination.pages > 1 && (
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={flavorPage === 1}
                  onClick={() => setFlavorPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {flavorPage} of {flavorData.pagination.pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={flavorPage >= flavorData.pagination.pages}
                  onClick={() => setFlavorPage((p) => p + 1)}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </>
        )}
        {flavorData && flavorData.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No ingredients found for this flavor category.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main Component ---

const FoodExplorer: React.FC = () => {
  const {
    selectedFoods,
    addToSelectedFoods,
    removeFromSelectedFoods,
    setSelectedFoods,
  } = useFoodContext();

  // --- Filter State ---
  const [searchTitle, setSearchTitle] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [selectedDiet, setSelectedDiet] = useState("all");
  const [cookingMethod, setCookingMethod] = useState("");
  const [utensils, setUtensils] = useState("");
  const [minCalories, setMinCalories] = useState("");
  const [maxCalories, setMaxCalories] = useState("");
  const [minProtein, setMinProtein] = useState("");
  const [maxProtein, setMaxProtein] = useState("");
  const [minCarbs, setMinCarbs] = useState("");
  const [maxCarbs, setMaxCarbs] = useState("");
  const [minEnergy, setMinEnergy] = useState("");
  const [maxEnergy, setMaxEnergy] = useState("");
  const [includeIngredients, setIncludeIngredients] = useState("");
  const [excludeIngredients, setExcludeIngredients] = useState("");
  const [includeCategories, setIncludeCategories] = useState("");
  const [excludeCategories, setExcludeCategories] = useState("");

  // --- UI State ---
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [detailRecipeId, setDetailRecipeId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTitle);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTitle]);

  // Reset page when any filter changes
  const resetPage = useCallback(() => setPage(1), []);

  // --- Determine which API endpoint to use ---
  const getActiveFilterMode = useCallback((): string => {
    // Priority order for filters - use the most specific endpoint available
    if (
      includeIngredients ||
      excludeIngredients ||
      includeCategories ||
      excludeCategories
    ) {
      return "ingredients-categories";
    }
    if (debouncedSearch) return "title-search";
    if (selectedRegion !== "All" && selectedDiet !== "all") return "region-diet";
    if (selectedRegion !== "All") return "cuisine";
    if (selectedDiet !== "all") return "diet";
    if (minCalories || maxCalories) return "calories";
    if (minProtein || maxProtein) return "protein";
    if (minCarbs || maxCarbs) return "carbs";
    if (minEnergy || maxEnergy) return "energy";
    if (cookingMethod) return "cooking-method";
    if (utensils) return "utensils";
    return "browse";
  }, [
    debouncedSearch,
    selectedRegion,
    selectedDiet,
    minCalories,
    maxCalories,
    minProtein,
    maxProtein,
    minCarbs,
    maxCarbs,
    minEnergy,
    maxEnergy,
    cookingMethod,
    utensils,
    includeIngredients,
    excludeIngredients,
    includeCategories,
    excludeCategories,
  ]);

  const filterMode = getActiveFilterMode();

  // --- Fetch recipes based on active filter ---
  const {
    data: recipesResult,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "recipes",
      filterMode,
      page,
      debouncedSearch,
      selectedRegion,
      selectedDiet,
      minCalories,
      maxCalories,
      minProtein,
      maxProtein,
      minCarbs,
      maxCarbs,
      minEnergy,
      maxEnergy,
      cookingMethod,
      utensils,
      includeIngredients,
      excludeIngredients,
      includeCategories,
      excludeCategories,
    ],
    queryFn: async (): Promise<{
      data: RecipeBasic[];
      pagination: { totalPages: number; currentPage: number; totalResults?: number };
    }> => {
      switch (filterMode) {
        case "title-search": {
          const results = await getRecipeByTitle(debouncedSearch);
          return {
            data: results || [],
            pagination: {
              totalPages: 1,
              currentPage: 1,
              totalResults: results?.length || 0,
            },
          };
        }
        case "cuisine":
          return getRecipesByCuisine(selectedRegion, page, ITEMS_PER_PAGE);
        case "diet": {
          const res = await getRecipesByDiet(selectedDiet, ITEMS_PER_PAGE, page);
          return {
            data: res.data,
            pagination: {
              totalPages: res.pagination.totalPages,
              currentPage: res.pagination.currentPage,
              totalResults: res.pagination.totalCount,
            },
          };
        }
        case "region-diet": {
          const res = await getRecipesByRegionAndDiet(
            selectedRegion,
            selectedDiet,
            ITEMS_PER_PAGE,
            page
          );
          return {
            data: res.data,
            pagination: {
              totalPages: res.pagination.totalPages,
              currentPage: res.pagination.currentPage,
              totalResults: res.pagination.totalCount,
            },
          };
        }
        case "calories": {
          const res = await getRecipesByCalories(
            Number(minCalories) || 0,
            Number(maxCalories) || 612854.6,
            ITEMS_PER_PAGE,
            page
          );
          return {
            data: res.data,
            pagination: {
              totalPages: res.pagination.totalPages,
              currentPage: res.pagination.currentPage,
              totalResults: res.pagination.totalResults,
            },
          };
        }
        case "protein": {
          const res = await getRecipesByProtein(
            Number(minProtein) || 0,
            Number(maxProtein) || 178134.3738,
            page,
            ITEMS_PER_PAGE
          );
          return {
            data: res.data,
            pagination: res.pagination,
          };
        }
        case "carbs": {
          const res = await getRecipesByCarbs(
            Number(minCarbs) || 0,
            Number(maxCarbs) || 100000,
            ITEMS_PER_PAGE,
            page
          );
          return {
            data: res.data,
            pagination: {
              totalPages: res.pagination.totalPages,
              currentPage: res.pagination.currentPage,
              totalResults: res.pagination.totalCount,
            },
          };
        }
        case "energy": {
          const res = await getRecipesByEnergy(
            Number(minEnergy) || 0,
            Number(maxEnergy) || 3440456.64,
            page,
            ITEMS_PER_PAGE
          );
          return { data: res.data, pagination: res.pagination };
        }
        case "cooking-method": {
          const res = await getRecipesByCookingMethod(cookingMethod, page);
          return { data: res.data, pagination: res.pagination };
        }
        case "utensils": {
          const res = await getRecipesByUtensils(utensils, page, ITEMS_PER_PAGE);
          return {
            data: res.data,
            pagination: {
              totalPages: res.pagination.totalPages,
              currentPage: res.pagination.currentPage,
              totalResults: res.pagination.total,
            },
          };
        }
        case "ingredients-categories": {
          const results = await getRecipesByIngredientsCategoriesTitle({
            includeIngredients: includeIngredients || undefined,
            excludeIngredients: excludeIngredients || undefined,
            includeCategories: includeCategories || undefined,
            excludeCategories: excludeCategories || undefined,
            title: debouncedSearch || undefined,
            page,
            limit: ITEMS_PER_PAGE,
          });
          return {
            data: results || [],
            pagination: {
              totalPages: 1,
              currentPage: 1,
              totalResults: results?.length || 0,
            },
          };
        }
        case "browse":
        default: {
          const res = await getRecipesInfo(page, ITEMS_PER_PAGE);
          return {
            data: res.data,
            pagination: {
              totalPages: res.pagination.totalPages,
              currentPage: res.pagination.currentPage,
              totalResults: res.pagination.totalCount,
            },
          };
        }
      }
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error?.message?.includes("429")) return false;
      return failureCount < 2;
    },
  });

  const recipes = recipesResult?.data || [];
  const pagination = recipesResult?.pagination || {
    totalPages: 1,
    currentPage: 1,
    totalResults: 0,
  };

  // --- Helpers ---
  const isSelected = (recipe: RecipeBasic) =>
    selectedFoods.some(
      (f) =>
        f.id === recipe.Recipe_id ||
        f.id === recipe._id ||
        f.Food_Item === recipe.Recipe_title
    );

  const clearAllFilters = () => {
    setSearchTitle("");
    setDebouncedSearch("");
    setSelectedRegion("All");
    setSelectedDiet("all");
    setCookingMethod("");
    setUtensils("");
    setMinCalories("");
    setMaxCalories("");
    setMinProtein("");
    setMaxProtein("");
    setMinCarbs("");
    setMaxCarbs("");
    setMinEnergy("");
    setMaxEnergy("");
    setIncludeIngredients("");
    setExcludeIngredients("");
    setIncludeCategories("");
    setExcludeCategories("");
    setPage(1);
  };

  const clearAllSelected = () => {
    setSelectedFoods([]);
    toast.success("Cleared all selections");
  };

  const hasActiveFilters =
    debouncedSearch ||
    selectedRegion !== "All" ||
    selectedDiet !== "all" ||
    cookingMethod ||
    utensils ||
    minCalories ||
    maxCalories ||
    minProtein ||
    maxProtein ||
    minCarbs ||
    maxCarbs ||
    minEnergy ||
    maxEnergy ||
    includeIngredients ||
    excludeIngredients ||
    includeCategories ||
    excludeCategories;

  const openDetail = (recipe: RecipeBasic) => {
    setDetailRecipeId(recipe.Recipe_id);
    setDetailOpen(true);
  };

  // --- Recipe Card ---
  const RecipeCard = ({ recipe }: { recipe: RecipeBasic }) => {
    const selected = isSelected(recipe);
    const dietBadges = getDietBadges(recipe);

    return (
      <Card className="h-full hover:shadow-lg transition-shadow duration-200 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-base leading-tight line-clamp-2">
              {recipe.Recipe_title}
            </CardTitle>
          </div>
          <CardDescription className="flex flex-wrap gap-1 mt-1">
            <Badge variant="outline" className="gap-1 text-xs">
              <MapPin className="w-2.5 h-2.5" />
              {recipe.Region || "Unknown"}
            </Badge>
            {recipe.Continent && (
              <Badge variant="secondary" className="text-xs">
                {recipe.Continent}
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex-1 flex flex-col">
          <div className="space-y-3 flex-1">
            {/* Diet badges */}
            <div className="flex flex-wrap gap-1">
              {dietBadges.length > 0 ? (
                dietBadges.map((b) => (
                  <Badge
                    key={b.label}
                    className={`${b.color} text-xs`}
                    variant="outline"
                  >
                    {b.label}
                  </Badge>
                ))
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs bg-gray-50 text-gray-600"
                >
                  Non-Veg
                </Badge>
              )}
            </div>

            {/* Nutrition grid */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calories:</span>
                <span className="font-medium">{formatNumber(recipe.Calories)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Protein:</span>
                <span className="font-medium">
                  {formatNumber(recipe["Protein (g)"])}g
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carbs:</span>
                <span className="font-medium">
                  {formatNumber(recipe["Carbohydrate, by difference (g)"])}g
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fat:</span>
                <span className="font-medium">
                  {formatNumber(recipe["Total lipid (fat) (g)"])}g
                </span>
              </div>
            </div>

            {/* Time & Servings */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {recipe.total_time && recipe.total_time !== "0" && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {recipe.total_time} min
                </span>
              )}
              {recipe.servings && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {recipe.servings}
                </span>
              )}
              {recipe.Source && (
                <span className="text-xs truncate">{recipe.Source}</span>
              )}
            </div>

            {/* Sub-region */}
            {recipe.Sub_region && recipe.Sub_region !== recipe.Region && (
              <p className="text-xs text-muted-foreground">
                <strong>Sub-region:</strong> {recipe.Sub_region}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDetail(recipe)}
              className="gap-1"
            >
              <Eye className="w-3 h-3" />
              Details
            </Button>
            {!selected ? (
              <Button
                size="sm"
                onClick={() => {
                  addToSelectedFoods(recipeToFood(recipe));
                  toast.success(`Added ${recipe.Recipe_title} to selection`);
                }}
                className="flex-1 gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </Button>
            ) : (
              <div className="flex gap-1 flex-1">
                <Button size="sm" disabled variant="secondary" className="flex-1">
                  <ShoppingCart className="w-3 h-3 mr-1" />
                  Added
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    removeFromSelectedFoods(recipeToFood(recipe));
                    toast.success(
                      `Removed ${recipe.Recipe_title} from selection`
                    );
                  }}
                >
                  <Minus className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // --- Recipe List Item ---
  const RecipeListItem = ({ recipe }: { recipe: RecipeBasic }) => {
    const selected = isSelected(recipe);
    const dietBadges = getDietBadges(recipe);

    return (
      <Card className="mb-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold truncate">{recipe.Recipe_title}</h3>
                <Badge variant="outline" className="text-xs gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  {recipe.Region || "Unknown"}
                </Badge>
                {recipe.Continent && (
                  <Badge variant="secondary" className="text-xs">
                    {recipe.Continent}
                  </Badge>
                )}
                {dietBadges.map((b) => (
                  <Badge
                    key={b.label}
                    className={`${b.color} text-xs`}
                    variant="outline"
                  >
                    {b.label}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span>{formatNumber(recipe.Calories)} cal</span>
                <span>{formatNumber(recipe["Protein (g)"])}g protein</span>
                <span>{formatNumber(recipe["Total lipid (fat) (g)"])}g fat</span>
                <span>
                  {formatNumber(recipe["Carbohydrate, by difference (g)"])}g carbs
                </span>
                {recipe.total_time && recipe.total_time !== "0" && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {recipe.total_time} min
                  </span>
                )}
                {recipe.servings && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {recipe.servings}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 ml-4 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDetail(recipe)}
              >
                <Eye className="w-3 h-3" />
              </Button>
              {!selected ? (
                <Button
                  size="sm"
                  onClick={() => {
                    addToSelectedFoods(recipeToFood(recipe));
                    toast.success(`Added ${recipe.Recipe_title} to selection`);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              ) : (
                <>
                  <Button size="sm" disabled variant="secondary">
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    Added
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      removeFromSelectedFoods(recipeToFood(recipe));
                      toast.success(
                        `Removed ${recipe.Recipe_title} from selection`
                      );
                    }}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // --- Render ---
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Food Explorer</h1>
          <p className="text-muted-foreground">
            Discover recipes from 118,000+ dishes worldwide using the FoodOScope
            database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ShoppingCart className="w-3 h-3" />
            {selectedFoods.length} selected
          </Badge>
          {selectedFoods.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAllSelected}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Recipe of the Day */}
      <RecipeOfDayCard />

      {/* Ingredient Flavor Explorer */}
      <FlavorExplorer />

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters & Search
              {hasActiveFilters && (
                <Badge variant="default" className="ml-2">
                  Active
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  <X className="w-3 h-3 mr-1" />
                  Clear Filters
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? "Basic Filters" : "Advanced Filters"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setViewMode(viewMode === "grid" ? "list" : "grid")
                }
              >
                {viewMode === "grid" ? "List View" : "Grid View"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Row 1: Primary Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Search by Title */}
            <div>
              <Label htmlFor="search">Search by Title</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search recipes..."
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Region / Cuisine */}
            <div>
              <Label>Region / Cuisine</Label>
              <Select
                value={selectedRegion}
                onValueChange={(v) => {
                  setSelectedRegion(v);
                  resetPage();
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGION_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Diet Type */}
            <div>
              <Label>Diet Type</Label>
              <Select
                value={selectedDiet}
                onValueChange={(v) => {
                  setSelectedDiet(v);
                  resetPage();
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIET_OPTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cooking Method */}
            <div>
              <Label>Cooking Method</Label>
              <Select
                value={cookingMethod}
                onValueChange={(v) => {
                  setCookingMethod(v);
                  resetPage();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  {COOKING_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value || "none"}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Range Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Calories Range */}
            <div>
              <Label>Calories Range</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minCalories}
                  onChange={(e) => {
                    setMinCalories(e.target.value);
                    resetPage();
                  }}
                  className="w-1/2"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxCalories}
                  onChange={(e) => {
                    setMaxCalories(e.target.value);
                    resetPage();
                  }}
                  className="w-1/2"
                />
              </div>
            </div>

            {/* Protein Range */}
            <div>
              <Label>Protein Range (g)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minProtein}
                  onChange={(e) => {
                    setMinProtein(e.target.value);
                    resetPage();
                  }}
                  className="w-1/2"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxProtein}
                  onChange={(e) => {
                    setMaxProtein(e.target.value);
                    resetPage();
                  }}
                  className="w-1/2"
                />
              </div>
            </div>

            {/* Carbs Range */}
            <div>
              <Label>Carbs Range (g)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minCarbs}
                  onChange={(e) => {
                    setMinCarbs(e.target.value);
                    resetPage();
                  }}
                  className="w-1/2"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxCarbs}
                  onChange={(e) => {
                    setMaxCarbs(e.target.value);
                    resetPage();
                  }}
                  className="w-1/2"
                />
              </div>
            </div>

            {/* Energy Range */}
            <div>
              <Label>Energy Range (kcal)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minEnergy}
                  onChange={(e) => {
                    setMinEnergy(e.target.value);
                    resetPage();
                  }}
                  className="w-1/2"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxEnergy}
                  onChange={(e) => {
                    setMaxEnergy(e.target.value);
                    resetPage();
                  }}
                  className="w-1/2"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Advanced Filters (toggleable) */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 pt-4 border-t">
              {/* Utensils */}
              <div>
                <Label>Utensils</Label>
                <Input
                  placeholder="e.g. basket, blender"
                  value={utensils}
                  onChange={(e) => {
                    setUtensils(e.target.value);
                    resetPage();
                  }}
                />
              </div>

              {/* Include Ingredients */}
              <div>
                <Label>Include Ingredients</Label>
                <Input
                  placeholder="e.g. tomato, onion"
                  value={includeIngredients}
                  onChange={(e) => {
                    setIncludeIngredients(e.target.value);
                    resetPage();
                  }}
                />
              </div>

              {/* Exclude Ingredients */}
              <div>
                <Label>Exclude Ingredients</Label>
                <Input
                  placeholder="e.g. peanut, gluten"
                  value={excludeIngredients}
                  onChange={(e) => {
                    setExcludeIngredients(e.target.value);
                    resetPage();
                  }}
                />
              </div>

              {/* Include Categories */}
              <div>
                <Label>Include Categories</Label>
                <Input
                  placeholder="e.g. Vegetable, Fruit"
                  value={includeCategories}
                  onChange={(e) => {
                    setIncludeCategories(e.target.value);
                    resetPage();
                  }}
                />
              </div>

              {/* Exclude Categories */}
              <div>
                <Label>Exclude Categories</Label>
                <Input
                  placeholder="e.g. Meat, Seafood"
                  value={excludeCategories}
                  onChange={(e) => {
                    setExcludeCategories(e.target.value);
                    resetPage();
                  }}
                />
              </div>
            </div>
          )}

          {/* Results Info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {isLoading
                ? "Loading recipes..."
                : `Showing ${recipes.length} recipes${
                    pagination.totalResults
                      ? ` of ${pagination.totalResults.toLocaleString()} total`
                      : ""
                  }`}
              {hasActiveFilters && (
                <span className="ml-2 text-xs">
                  (Filter: {filterMode.replace(/-/g, " ")})
                </span>
              )}
            </span>
            <span>{selectedFoods.length} foods selected for meal planning</span>
          </div>
        </CardContent>
      </Card>

      {/* Selected Foods Quick View */}
      {selectedFoods.length > 0 && (
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-green-600" />
              Selected Foods ({selectedFoods.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedFoods.slice(0, 10).map((food) => (
                <Badge
                  key={food.id}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-red-100"
                  onClick={() => {
                    removeFromSelectedFoods(food);
                    toast.success(`Removed ${food.Food_Item} from selection`);
                  }}
                >
                  {food.Food_Item}
                  <Minus className="w-3 h-3" />
                </Badge>
              ))}
              {selectedFoods.length > 10 && (
                <Badge variant="outline">
                  +{selectedFoods.length - 10} more...
                </Badge>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={clearAllSelected} variant="outline">
                Clear All
              </Button>
              <Button size="sm" className="gap-1">
                <Utensils className="w-3 h-3" />
                Go to Recipe Builder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {isError && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <Info className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-lg font-medium mb-2 text-red-800">
              Failed to load recipes
            </p>
            <p className="text-sm text-red-600 mb-4">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                clearAllFilters();
              }}
            >
              Reset Filters & Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && <LoadingSkeleton />}

      {/* Recipes Grid / List */}
      {!isLoading && !isError && (
        <>
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recipes.length > 0 ? (
                recipes.map((recipe, index) => (
                  <RecipeCard
                    key={recipe._id || `${recipe.Recipe_id}-${index}`}
                    recipe={recipe}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Info className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">No recipes found</p>
                  <p className="text-muted-foreground">
                    Try adjusting your filters or search terms
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={clearAllFilters}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {recipes.length > 0 ? (
                recipes.map((recipe, index) => (
                  <RecipeListItem
                    key={recipe._id || `${recipe.Recipe_id}-${index}`}
                    recipe={recipe}
                  />
                ))
              ) : (
                <div className="text-center py-12">
                  <Info className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">No recipes found</p>
                  <p className="text-muted-foreground">
                    Try adjusting your filters or search terms
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={clearAllFilters}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Nutrition Summary for Selected Foods */}
      {selectedFoods.length > 0 && (
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">
              Selected Foods Nutrition Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {selectedFoods
                    .reduce((acc, f) => acc + Number(f.Calories), 0)
                    .toFixed(0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Calories</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {selectedFoods
                    .reduce((acc, f) => acc + Number(f.Protein), 0)
                    .toFixed(1)}
                  g
                </p>
                <p className="text-sm text-muted-foreground">Total Protein</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {selectedFoods
                    .reduce((acc, f) => acc + Number(f.Fat), 0)
                    .toFixed(1)}
                  g
                </p>
                <p className="text-sm text-muted-foreground">Total Fat</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {selectedFoods
                    .reduce((acc, f) => acc + Number(f.Carbs), 0)
                    .toFixed(1)}
                  g
                </p>
                <p className="text-sm text-muted-foreground">Total Carbs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipeId={detailRecipeId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
};

export default FoodExplorer;
