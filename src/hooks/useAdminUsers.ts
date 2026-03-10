import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  role_row_id: string;
  created_at: string;
}

interface AdminUserFilters {
  search?: string;
}

// ---------------------------------------------------------------------------
// Query: list all users with their roles
// ---------------------------------------------------------------------------

export function useAdminUsers(filters: AdminUserFilters = {}) {
  return useQuery({
    queryKey: ["admin-users", filters],
    queryFn: async (): Promise<UserWithRole[]> => {
      // Fetch profiles joined with user_roles.
      // Supabase PostgREST join syntax: profile has a 1:1 relationship
      // with user_roles via user_roles.user_id → profiles.id.
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          id,
          email,
          full_name,
          avatar_url,
          created_at,
          user_roles!inner ( id, role )
        `
        )
        .order("full_name", { ascending: true, nullsFirst: false })
        .order("email");

      if (error) throw error;

      let users = (data ?? []).map((row): UserWithRole => {
        const r = row as Record<string, unknown>;
        // user_roles is an object (not array) because of the !inner 1:1 join
        const roleData = r.user_roles as { id: string; role: string };

        return {
          id: row.id,
          email: row.email,
          full_name: row.full_name,
          avatar_url: row.avatar_url,
          role: roleData.role as UserRole,
          role_row_id: roleData.id,
          created_at: row.created_at,
        };
      });

      // Client-side search filter (profiles table doesn't support
      // OR ilike across joined columns cleanly in PostgREST)
      if (filters.search) {
        const q = filters.search.toLowerCase();
        users = users.filter(
          (u) =>
            u.email.toLowerCase().includes(q) ||
            (u.full_name?.toLowerCase().includes(q) ?? false)
        );
      }

      return users;
    },
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: update a user's role
// ---------------------------------------------------------------------------

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      roleRowId,
      newRole,
    }: {
      userId: string;
      roleRowId: string;
      newRole: UserRole;
    }) => {
      if (!currentUser) throw new Error("Not authenticated");

      // Safety: prevent admin from changing their own role
      if (userId === currentUser.id) {
        throw new Error("You cannot change your own role.");
      }

      const { data, error } = await supabase
        .from("user_roles")
        .update({
          role: newRole,
          updated_by: currentUser.id,
        })
        .eq("id", roleRowId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    // Optimistic update: change the role in the cache immediately
    onMutate: async ({ roleRowId, newRole }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-users"] });

      const previousQueries = queryClient.getQueriesData<UserWithRole[]>({
        queryKey: ["admin-users"],
      });

      queryClient.setQueriesData<UserWithRole[]>(
        { queryKey: ["admin-users"] },
        (old) =>
          old?.map((u) =>
            u.role_row_id === roleRowId ? { ...u, role: newRole } : u
          )
      );

      return { previousQueries };
    },

    onError: (_err, _vars, context) => {
      // Roll back on failure
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
