import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three taxonomy tables share the same column shape. */
export type TaxonomyTable = "service_lines" | "workstreams" | "activity_types";

export interface TaxonomyItem {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaxonomyInput {
  name: string;
  display_order: number;
}

export interface UpdateTaxonomyInput {
  id: string;
  name?: string;
  display_order?: number;
}

// ---------------------------------------------------------------------------
// Map table names to their TanStack Query cache keys.
// When we mutate a taxonomy table we also invalidate the
// dropdown-facing cache keys used by the time entry form.
// ---------------------------------------------------------------------------

const TABLE_CACHE_KEYS: Record<TaxonomyTable, string[]> = {
  service_lines: ["admin-service-lines", "service-lines"],
  workstreams: ["admin-workstreams", "workstreams"],
  activity_types: ["admin-activity-types", "activity-types"],
};

// ---------------------------------------------------------------------------
// Query: list all items (including archived for admin)
// ---------------------------------------------------------------------------

export function useAdminTaxonomy(
  table: TaxonomyTable,
  includeArchived: boolean = false
) {
  const adminKey = TABLE_CACHE_KEYS[table]![0]!;

  return useQuery({
    queryKey: [adminKey, { includeArchived }],
    queryFn: async (): Promise<TaxonomyItem[]> => {
      let query = supabase
        .from(table)
        .select("*")
        .order("display_order")
        .order("name");

      if (!includeArchived) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TaxonomyItem[];
    },
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create item
// ---------------------------------------------------------------------------

export function useCreateTaxonomyItem(table: TaxonomyTable) {
  const queryClient = useQueryClient();
  const keys = TABLE_CACHE_KEYS[table]!;

  return useMutation({
    mutationFn: async (input: CreateTaxonomyInput) => {
      const { data, error } = await supabase
        .from(table)
        .insert({
          name: input.name.trim(),
          display_order: input.display_order,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error(`A ${table.replace(/_/g, " ").replace(/s$/, "")} with this name already exists.`);
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: update item (name and/or display_order)
// ---------------------------------------------------------------------------

export function useUpdateTaxonomyItem(table: TaxonomyTable) {
  const queryClient = useQueryClient();
  const keys = TABLE_CACHE_KEYS[table]!;

  return useMutation({
    mutationFn: async (input: UpdateTaxonomyInput) => {
      const updatePayload: Record<string, unknown> = {};
      if (input.name !== undefined) updatePayload.name = input.name.trim();
      if (input.display_order !== undefined)
        updatePayload.display_order = input.display_order;

      const { data, error } = await supabase
        .from(table)
        .update(updatePayload)
        .eq("id", input.id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("This name is already in use.");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: toggle archive status (soft delete)
// ---------------------------------------------------------------------------

export function useToggleTaxonomyArchive(table: TaxonomyTable) {
  const queryClient = useQueryClient();
  const keys = TABLE_CACHE_KEYS[table]!;

  return useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { data, error } = await supabase
        .from(table)
        .update({ is_active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
