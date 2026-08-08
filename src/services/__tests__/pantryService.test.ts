import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Supabase stub for the chains pantryService uses:
 * `from(t).select().eq().order()`, `.insert().select().single()`,
 * `.update().eq().select().single()` and `.delete().eq()`.
 */
const state = vi.hoisted(() => ({
  selectResult: { data: [] as unknown[], error: null as unknown },
  singleResult: { data: null as unknown, error: null as unknown },
  deleteResult: { error: null as unknown },
  lastInsert: null as unknown,
  lastUpdate: null as unknown,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = async () => state.selectResult;
      builder.single = async () => state.singleResult;
      builder.insert = (row: unknown) => {
        state.lastInsert = row;
        return builder;
      };
      builder.update = (row: unknown) => {
        state.lastUpdate = row;
        return builder;
      };
      builder.delete = () => ({
        eq: async () => state.deleteResult,
      });
      return builder;
    },
  },
}));

const {
  fetchPantryItems,
  addPantryItem,
  deletePantryItem,
  pantryIngredientNames,
} = await import("../pantryService");

const row = {
  id: "item-1",
  patient_id: "patient-1",
  food_name: "Brown rice",
  category: "Grains & Cereals",
  quantity: "2 kg",
  availability: "at_home",
  notes: "",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  state.selectResult = { data: [], error: null };
  state.singleResult = { data: null, error: null };
  state.deleteResult = { error: null };
  state.lastInsert = null;
  state.lastUpdate = null;
});

describe("fetchPantryItems", () => {
  it("maps rows to camelCase items", async () => {
    state.selectResult = { data: [row], error: null };

    const items = await fetchPantryItems("patient-1");

    expect(items).toEqual([
      {
        id: "item-1",
        patientId: "patient-1",
        foodName: "Brown rice",
        category: "Grains & Cereals",
        quantity: "2 kg",
        availability: "at_home",
        notes: "",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("throws with the Supabase message on error", async () => {
    state.selectResult = { data: null, error: { message: "denied" } };

    await expect(fetchPantryItems("patient-1")).rejects.toThrow("denied");
  });
});

describe("addPantryItem", () => {
  it("trims the name and defaults the optional fields", async () => {
    state.singleResult = { data: row, error: null };

    await addPantryItem("patient-1", { foodName: "  Brown rice  " });

    expect(state.lastInsert).toEqual({
      patient_id: "patient-1",
      food_name: "Brown rice",
      category: "Other",
      quantity: "",
      availability: "at_home",
      notes: "",
    });
  });
});

describe("deletePantryItem", () => {
  it("throws when the delete is rejected", async () => {
    state.deleteResult = { error: { message: "not allowed" } };

    await expect(deletePantryItem("item-1")).rejects.toThrow("not allowed");
  });
});

describe("pantryIngredientNames", () => {
  const items = [
    { ...row, id: "1", foodName: "Rice", availability: "at_home" },
    { ...row, id: "2", foodName: "rice", availability: "at_home" },
    { ...row, id: "3", foodName: "Spinach", availability: "to_buy" },
  ].map((item) => ({
    id: item.id,
    patientId: item.patient_id,
    foodName: item.foodName,
    category: item.category,
    quantity: item.quantity,
    availability: item.availability as "at_home" | "to_buy",
    notes: item.notes,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));

  it("lowercases and dedupes across the whole list", () => {
    expect(pantryIngredientNames(items)).toEqual(["rice", "spinach"]);
  });

  it("filters by availability when asked", () => {
    expect(pantryIngredientNames(items, "to_buy")).toEqual(["spinach"]);
  });
});
