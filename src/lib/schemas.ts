import { z } from "zod";

/**
 * Zod schema for time entry form validation.
 *
 * Used by both the Dashboard quick entry form and the
 * inline edit form on the My Entries page.
 */
export const timeEntrySchema = z.object({
  entry_date: z
    .string()
    .min(1, "Date is required")
    .refine(
      (v) => !isNaN(Date.parse(v)),
      "Invalid date"
    )
    .refine(
      (v) => {
        // Allow today and past dates, not future
        const entry = new Date(v + "T00:00:00");
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return entry <= today;
      },
      "Date cannot be in the future"
    ),

  customer_id: z
    .string()
    .min(1, "Select a customer"),

  service_line_id: z
    .string()
    .min(1, "Select a service line"),

  workstream_id: z
    .string()
    .min(1, "Select a workstream"),

  activity_type_id: z
    .string()
    .min(1, "Select an activity type"),

  duration_minutes: z
    .number({ invalid_type_error: "Enter a number" })
    .int("Must be a whole number")
    .min(1, "At least 1 minute")
    .max(1440, "Cannot exceed 24 hours"),

  notes: z
    .string()
    .max(2000, "Notes cannot exceed 2,000 characters")
    .optional()
    .default(""),
});

export type TimeEntryFormValues = z.infer<typeof timeEntrySchema>;

// ---------------------------------------------------------------------------
// Customer form
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name cannot exceed 200 characters"),
  external_account_id: z
    .string()
    .min(1, "External Account ID is required")
    .max(100, "ID cannot exceed 100 characters"),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

// ---------------------------------------------------------------------------
// Taxonomy item form (service line, workstream, activity type)
// ---------------------------------------------------------------------------

export const taxonomyItemSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name cannot exceed 100 characters"),
  display_order: z
    .number({ invalid_type_error: "Enter a number" })
    .int("Must be a whole number")
    .min(0, "Must be 0 or greater"),
});

export type TaxonomyItemFormValues = z.infer<typeof taxonomyItemSchema>;
