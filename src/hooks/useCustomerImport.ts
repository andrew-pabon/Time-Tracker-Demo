import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { CsvRow } from "@/lib/csv-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportResult {
  inserted: number;
  updated: number;
  failed: number;
  errors: { rowNumber: number; message: string }[];
  logId: string | null;
}

// ---------------------------------------------------------------------------
// Mutation: upsert customers from parsed CSV rows
// ---------------------------------------------------------------------------

/**
 * Upserts parsed CSV rows into the customers table.
 *
 * Strategy: processes all rows client-side via Supabase's upsert.
 * The `external_account_id` column has a UNIQUE constraint which
 * Supabase's `upsert` uses as the conflict target.
 *
 * For MVP this runs in a single batch via the Supabase client.
 * This is sufficient for files up to ~10,000 rows.
 * For larger scale, an Edge Function with service_role key
 * and a batched transaction would be the next step.
 */
export function useCustomerImport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      rows,
      fileName,
    }: {
      rows: CsvRow[];
      fileName: string;
    }): Promise<ImportResult> => {
      if (!user) throw new Error("Not authenticated");

      const result: ImportResult = {
        inserted: 0,
        updated: 0,
        failed: 0,
        errors: [],
        logId: null,
      };

      // ---------------------------------------------------------------
      // 1. Fetch existing external IDs so we can distinguish insert vs update
      // ---------------------------------------------------------------
      const externalIds = rows.map((r) => r.external_account_id);

      const { data: existing, error: fetchErr } = await supabase
        .from("customers")
        .select("external_account_id")
        .in("external_account_id", externalIds);

      if (fetchErr) throw fetchErr;

      const existingSet = new Set(
        (existing ?? []).map((c) => c.external_account_id)
      );

      // ---------------------------------------------------------------
      // 2. Upsert all rows in one call
      //
      // Supabase .upsert() with onConflict sends a single
      // INSERT ... ON CONFLICT DO UPDATE to Postgres.
      // ---------------------------------------------------------------
      const upsertPayload = rows.map((row) => ({
        external_account_id: row.external_account_id,
        name: row.name,
        is_active: true,
        created_by: user.id,
        updated_by: user.id,
      }));

      const { error: upsertErr } = await supabase
        .from("customers")
        .upsert(upsertPayload, {
          onConflict: "external_account_id",
          ignoreDuplicates: false,
        });

      if (upsertErr) {
        // If the entire batch fails, record it
        throw new Error(`Import failed: ${upsertErr.message}`);
      }

      // ---------------------------------------------------------------
      // 3. Count inserts vs updates
      // ---------------------------------------------------------------
      for (const row of rows) {
        if (existingSet.has(row.external_account_id)) {
          result.updated++;
        } else {
          result.inserted++;
        }
      }

      // ---------------------------------------------------------------
      // 4. Write import log
      // ---------------------------------------------------------------
      const { data: logRow } = await supabase
        .from("customer_import_logs")
        .insert({
          uploaded_by: user.id,
          file_name: fileName,
          row_count: rows.length,
        })
        .select("id")
        .single();

      if (logRow) {
        result.logId = logRow.id;

        // Update the log with results
        await supabase
          .from("customer_import_logs")
          .update({
            inserted_count: result.inserted,
            updated_count: result.updated,
            error_count: result.failed,
            errors: result.errors,
            status: "completed" as const,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq("id", logRow.id);
      }

      return result;
    },
    onSuccess: () => {
      // Refresh all customer lists
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
