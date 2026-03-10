import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ServiceLine, Workstream, ActivityType } from "@/types/database";

/**
 * Fetches active service lines sorted by display_order.
 */
export function useServiceLines() {
  return useQuery({
    queryKey: ["service-lines"],
    queryFn: async (): Promise<ServiceLine[]> => {
      const { data, error } = await supabase
        .from("service_lines")
        .select("*")
        .eq("is_active", true)
        .order("display_order")
        .order("name");

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches active workstreams sorted by display_order.
 */
export function useWorkstreams() {
  return useQuery({
    queryKey: ["workstreams"],
    queryFn: async (): Promise<Workstream[]> => {
      const { data, error } = await supabase
        .from("workstreams")
        .select("*")
        .eq("is_active", true)
        .order("display_order")
        .order("name");

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches active activity types sorted by display_order.
 */
export function useActivityTypes() {
  return useQuery({
    queryKey: ["activity-types"],
    queryFn: async (): Promise<ActivityType[]> => {
      const { data, error } = await supabase
        .from("activity_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order")
        .order("name");

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Convenience hook that loads all three taxonomy tables in parallel.
 */
export function useTaxonomy() {
  const serviceLines = useServiceLines();
  const workstreams = useWorkstreams();
  const activityTypes = useActivityTypes();

  return {
    serviceLines,
    workstreams,
    activityTypes,
    isLoading:
      serviceLines.isLoading ||
      workstreams.isLoading ||
      activityTypes.isLoading,
    isError:
      serviceLines.isError || workstreams.isError || activityTypes.isError,
  };
}
