// src/services/pantryService.ts
// Supabase persistence for a patient's pantry — the foods they already have at
// home plus the ones they intend to buy. Patients own their rows; the doctors
// treating them can read (never write) them, which is what powers the Patient
// Pantry tab of the doctor Food Explorer.

import { supabase } from "@/lib/supabase";

export type PantryAvailability = "at_home" | "to_buy";

export interface PantryItem {
  id: string;
  patientId: string;
  foodName: string;
  /** The plain ingredient noun the recipe API understands ("rice"). */
  searchTerm: string;
  category: string;
  quantity: string;
  availability: PantryAvailability;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PantryItemInput {
  foodName: string;
  searchTerm?: string;
  category?: string;
  quantity?: string;
  availability?: PantryAvailability;
  notes?: string;
}

interface PantryRow {
  id: string;
  patient_id: string;
  food_name: string;
  search_term: string | null;
  category: string | null;
  quantity: string | null;
  availability: PantryAvailability;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const toPantryItem = (row: PantryRow): PantryItem => ({
  id: row.id,
  patientId: row.patient_id,
  foodName: row.food_name,
  // Rows written before the ingredient catalogue existed have no search term;
  // their free-text name is the best we have.
  searchTerm: row.search_term || row.food_name,
  category: row.category ?? "Other",
  quantity: row.quantity ?? "",
  availability: row.availability,
  notes: row.notes ?? "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Every pantry item for a patient, newest first. */
export const fetchPantryItems = async (
  patientId: string
): Promise<PantryItem[]> => {
  const { data, error } = await supabase
    .from("patient_pantry_items")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as PantryRow[]).map(toPantryItem);
};

export const addPantryItem = async (
  patientId: string,
  input: PantryItemInput
): Promise<PantryItem> => {
  const { data, error } = await supabase
    .from("patient_pantry_items")
    .insert({
      patient_id: patientId,
      food_name: input.foodName.trim(),
      search_term: input.searchTerm?.trim().toLowerCase() || input.foodName.trim().toLowerCase(),
      category: input.category?.trim() || "Other",
      quantity: input.quantity?.trim() ?? "",
      availability: input.availability ?? "at_home",
      notes: input.notes?.trim() ?? "",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toPantryItem(data as PantryRow);
};

export const updatePantryItem = async (
  itemId: string,
  changes: Partial<PantryItemInput>
): Promise<PantryItem> => {
  const patch: Record<string, unknown> = {};
  if (changes.foodName !== undefined) patch.food_name = changes.foodName.trim();
  if (changes.searchTerm !== undefined) patch.search_term = changes.searchTerm.trim().toLowerCase();
  if (changes.category !== undefined) patch.category = changes.category;
  if (changes.quantity !== undefined) patch.quantity = changes.quantity;
  if (changes.availability !== undefined) patch.availability = changes.availability;
  if (changes.notes !== undefined) patch.notes = changes.notes;

  const { data, error } = await supabase
    .from("patient_pantry_items")
    .update(patch)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toPantryItem(data as PantryRow);
};

export const deletePantryItem = async (itemId: string): Promise<void> => {
  const { error } = await supabase
    .from("patient_pantry_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);
};

/**
 * The recipe-search terms a plan can be built around, deduped and lowercased.
 * Several pantry entries can share a term ("Brown rice" and "Rice (white)" are
 * both `rice`), which is why this dedupes.
 */
export const pantryIngredientNames = (
  items: PantryItem[],
  availability?: PantryAvailability
): string[] => {
  const names = items
    .filter((item) => !availability || item.availability === availability)
    .map((item) => (item.searchTerm || item.foodName).trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(names)];
};
