import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Customer } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminCustomerFilters {
  search?: string;
  includeArchived?: boolean;
}

export interface CreateCustomerInput {
  name: string;
  external_account_id: string;
}

export interface UpdateCustomerInput {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Query: list customers for admin (includes archived when requested)
// ---------------------------------------------------------------------------

export function useAdminCustomers(filters: AdminCustomerFilters = {}) {
  return useQuery({
    queryKey: ["admin-customers", filters],
    queryFn: async (): Promise<Customer[]> => {
      let query = supabase
        .from("customers")
        .select("*")
        .order("name");

      if (!filters.includeArchived) {
        query = query.eq("is_active", true);
      }

      if (filters.search) {
        // Supabase ilike for case-insensitive search across name and external ID
        query = query.or(
          `name.ilike.%${filters.search}%,external_account_id.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create customer
// ---------------------------------------------------------------------------

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: input.name.trim(),
          external_account_id: input.external_account_id.trim(),
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error(
            "A customer with this External Account ID already exists."
          );
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: update customer name
// ---------------------------------------------------------------------------

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateCustomerInput) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customers")
        .update({
          name: input.name.trim(),
          updated_by: user.id,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: toggle archive status
// ---------------------------------------------------------------------------

export function useToggleCustomerArchive() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("customers")
        .update({ is_active, updated_by: user.id })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
