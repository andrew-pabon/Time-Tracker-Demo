import Papa from "papaparse";
import {
  CSV_MAX_FILE_SIZE,
  CSV_REQUIRED_COLUMNS,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CsvRow {
  /** Row number in the original file (1-indexed, excludes header). */
  rowNumber: number;
  external_account_id: string;
  name: string;
}

export interface CsvValidationError {
  rowNumber: number | null;
  field: string | null;
  message: string;
}

export interface CsvParseResult {
  rows: CsvRow[];
  errors: CsvValidationError[];
  /** True only when there are zero errors. */
  isValid: boolean;
  totalRows: number;
}

// ---------------------------------------------------------------------------
// Parse and validate
// ---------------------------------------------------------------------------

/**
 * Parse a CSV file, validate headers and row-level data, return typed rows.
 *
 * All validation happens client-side before any data is sent to Supabase.
 * This catches structural and data-quality problems early so the admin
 * can fix the file without wasting a round-trip.
 */
export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    // File-level checks
    if (file.size > CSV_MAX_FILE_SIZE) {
      resolve({
        rows: [],
        errors: [
          {
            rowNumber: null,
            field: null,
            message: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 5 MB.`,
          },
        ],
        isValid: false,
        totalRows: 0,
      });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => {
        const errors: CsvValidationError[] = [];

        // ---------------------------------------------------------------
        // Header validation
        // ---------------------------------------------------------------
        const headers = result.meta.fields ?? [];
        const normalizedHeaders = new Set(headers);

        for (const required of CSV_REQUIRED_COLUMNS) {
          if (!normalizedHeaders.has(required)) {
            errors.push({
              rowNumber: null,
              field: required,
              message: `Missing required column: "${required}"`,
            });
          }
        }

        if (errors.length > 0) {
          resolve({ rows: [], errors, isValid: false, totalRows: 0 });
          return;
        }

        // ---------------------------------------------------------------
        // Row-level validation
        // ---------------------------------------------------------------
        const rows: CsvRow[] = [];
        const seenIds = new Map<string, number>();

        const rawRows = result.data as Record<string, string>[];

        for (let i = 0; i < rawRows.length; i++) {
          const raw = rawRows[i]!;
          const rowNumber = i + 1; // 1-indexed for human display

          const externalId = (raw["external_account_id"] ?? "").trim();
          const name = (raw["name"] ?? "").trim();

          // Empty external_account_id
          if (!externalId) {
            errors.push({
              rowNumber,
              field: "external_account_id",
              message: `Row ${rowNumber}: external_account_id is empty`,
            });
            continue;
          }

          // Empty name
          if (!name) {
            errors.push({
              rowNumber,
              field: "name",
              message: `Row ${rowNumber}: name is empty`,
            });
            continue;
          }

          // Duplicate within file
          const previousRow = seenIds.get(externalId);
          if (previousRow !== undefined) {
            errors.push({
              rowNumber,
              field: "external_account_id",
              message: `Row ${rowNumber}: duplicate external_account_id "${externalId}" (first seen on row ${previousRow})`,
            });
            continue;
          }

          // Length limits matching the database schema
          if (externalId.length > 100) {
            errors.push({
              rowNumber,
              field: "external_account_id",
              message: `Row ${rowNumber}: external_account_id exceeds 100 characters`,
            });
            continue;
          }

          if (name.length > 200) {
            errors.push({
              rowNumber,
              field: "name",
              message: `Row ${rowNumber}: name exceeds 200 characters`,
            });
            continue;
          }

          seenIds.set(externalId, rowNumber);
          rows.push({ rowNumber, external_account_id: externalId, name });
        }

        resolve({
          rows,
          errors,
          isValid: errors.length === 0,
          totalRows: rawRows.length,
        });
      },
      error: (err) => {
        resolve({
          rows: [],
          errors: [
            {
              rowNumber: null,
              field: null,
              message: `Failed to parse CSV: ${err.message}`,
            },
          ],
          isValid: false,
          totalRows: 0,
        });
      },
    });
  });
}
