import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Customer } from "@/types/database";

/**
 * Fetches active customers sorted by name.
 * Used in time entry form dropdowns and filter selectors.
 *
 * staleTime is generous (5min) since the customer list rarely changes.
 */
export function useCustomers() {
  return useQuery({
    queryKey: ["customers", { active: true }],
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
