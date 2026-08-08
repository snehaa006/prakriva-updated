import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, LayoutGrid } from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { CACHE_KEYS } from "@/lib/localCache";
import { PersonalizedGenerator } from "@/components/diet/PersonalizedGenerator";
import { ManualMealBuilder } from "@/components/diet/ManualMealBuilder";

const RecipeBuilder = () => {
  const [searchParams] = useSearchParams();

  // Which half of the builder is showing. Persisted so a refresh doesn't
  // silently drop a doctor back onto the generator mid-edit.
  const [activeTab, setActiveTab] = usePersistentState(
    CACHE_KEYS.recipeBuilderDraft + ":activeTab",
    "generator"
  );

  // A link into ?editPlanId=&patientId= — from the generator's "Edit in
  // Manual Builder" button, or from the Diet Chart viewer's Edit button —
  // always means the manual tab, regardless of whichever tab was last active.
  useEffect(() => {
    if (searchParams.get("editPlanId")) setActiveTab("manual");
  }, [searchParams, setActiveTab]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Recipe Builder</h1>
        <p className="text-muted-foreground">
          Generate a dosha-personalized diet chart, or build a meal plan by hand.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="generator" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Personalized Generator
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5" />
            Manual Builder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="mt-6">
          <PersonalizedGenerator />
        </TabsContent>
        <TabsContent value="manual" className="mt-6">
          <ManualMealBuilder />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RecipeBuilder;
