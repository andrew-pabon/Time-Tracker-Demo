import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { timeEntrySchema, type TimeEntryFormValues } from "@/lib/schemas";
import { todayISO } from "@/lib/utils";
import { useCustomers } from "@/hooks/useCustomers";
import { useTaxonomy } from "@/hooks/useTaxonomy";
import { useReportingPeriodStatus } from "@/hooks/useReportingPeriodStatus";
import { FormField } from "@/components/ui/FormField";
import { SelectInput } from "@/components/ui/SelectInput";
import { DurationInput } from "@/components/time-entry/DurationInput";
import { Button } from "@/components/ui/Button";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeEntryFormProps {
  /** Pre-fill values when editing an existing entry. */
  initialValues?: Partial<TimeEntryFormValues>;
  /** True when editing an existing entry (vs creating new). */
  isEditing?: boolean;
  /** Called on successful form submission. */
  onSubmit: (values: TimeEntryFormValues) => Promise<void>;
  /** Called when user clicks Cancel during edit. */
  onCancel?: () => void;
  /** Whether the submit mutation is currently in flight. */
  isSubmitting?: boolean;
  /**
   * If true, retain customer and date after successful submit.
   * Used on Dashboard for rapid sequential entry.
   */
  retainContext?: boolean;
  /** Additional CSS class on the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeEntryForm({
  initialValues,
  isEditing = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
  retainContext = false,
  className,
}: TimeEntryFormProps) {
  // ---------------------------------------------------------------------------
  // Reference data
  // ---------------------------------------------------------------------------
  const { data: customers, isLoading: customersLoading } = useCustomers();
  const { serviceLines, workstreams, activityTypes, isLoading: taxLoading } =
    useTaxonomy();

  const isRefDataLoading = customersLoading || taxLoading;

  // ---------------------------------------------------------------------------
  // Form setup
  // ---------------------------------------------------------------------------
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<TimeEntryFormValues>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      entry_date: initialValues?.entry_date ?? todayISO(),
      customer_id: initialValues?.customer_id ?? "",
      service_line_id: initialValues?.service_line_id ?? "",
      workstream_id: initialValues?.workstream_id ?? "",
      activity_type_id: initialValues?.activity_type_id ?? "",
      duration_minutes: initialValues?.duration_minutes ?? ("" as unknown as number),
      notes: initialValues?.notes ?? "",
    },
  });

  // When initialValues change (e.g. switching to edit mode), reset the form
  useEffect(() => {
    if (initialValues) {
      reset({
        entry_date: initialValues.entry_date ?? todayISO(),
        customer_id: initialValues.customer_id ?? "",
        service_line_id: initialValues.service_line_id ?? "",
        workstream_id: initialValues.workstream_id ?? "",
        activity_type_id: initialValues.activity_type_id ?? "",
        duration_minutes: initialValues.duration_minutes ?? ("" as unknown as number),
        notes: initialValues.notes ?? "",
      });
    }
  }, [initialValues, reset]);

  // ---------------------------------------------------------------------------
  // Lock check: watch customer + date to determine if period is approved
  // ---------------------------------------------------------------------------
  const watchedCustomer = watch("customer_id");
  const watchedDate = watch("entry_date");

  const { data: periodStatus } = useReportingPeriodStatus(
    watchedCustomer || undefined,
    watchedDate || undefined
  );

  const isLocked = periodStatus?.isLocked ?? false;

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  async function handleFormSubmit(values: TimeEntryFormValues) {
    await onSubmit(values);

    // After successful create, reset form — but optionally keep context fields
    if (!isEditing) {
      if (retainContext) {
        reset({
          entry_date: values.entry_date,
          customer_id: values.customer_id,
          service_line_id: "",
          workstream_id: "",
          activity_type_id: "",
          duration_minutes: "" as unknown as number,
          notes: "",
        });
      } else {
        reset();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn("space-y-3", className)}
      noValidate
    >
      {/* Lock warning banner */}
      {isLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            This reporting period is approved.{" "}
            {isEditing ? "Changes cannot be saved." : "New entries cannot be added."}
          </span>
        </div>
      )}

      {/* Date */}
      <FormField label="Date" error={errors.entry_date?.message}>
        <input
          type="date"
          max={todayISO()}
          {...register("entry_date")}
          className={cn(
            "block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm",
            "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
            errors.entry_date ? "border-red-300" : "border-surface-300"
          )}
        />
      </FormField>

      {/* Customer */}
      <FormField label="Customer" error={errors.customer_id?.message}>
        <SelectInput
          {...register("customer_id")}
          error={!!errors.customer_id}
          disabled={isRefDataLoading}
        >
          <option value="">
            {customersLoading ? "Loading…" : "Select customer…"}
          </option>
          {customers?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
      </FormField>

      {/* Service Line */}
      <FormField label="Service Line" error={errors.service_line_id?.message}>
        <SelectInput
          {...register("service_line_id")}
          error={!!errors.service_line_id}
          disabled={isRefDataLoading}
        >
          <option value="">
            {taxLoading ? "Loading…" : "Select service line…"}
          </option>
          {serviceLines.data?.map((sl) => (
            <option key={sl.id} value={sl.id}>
              {sl.name}
            </option>
          ))}
        </SelectInput>
      </FormField>

      {/* Workstream */}
      <FormField label="Workstream" error={errors.workstream_id?.message}>
        <SelectInput
          {...register("workstream_id")}
          error={!!errors.workstream_id}
          disabled={isRefDataLoading}
        >
          <option value="">
            {taxLoading ? "Loading…" : "Select workstream…"}
          </option>
          {workstreams.data?.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </SelectInput>
      </FormField>

      {/* Activity Type */}
      <FormField label="Activity Type" error={errors.activity_type_id?.message}>
        <SelectInput
          {...register("activity_type_id")}
          error={!!errors.activity_type_id}
          disabled={isRefDataLoading}
        >
          <option value="">
            {taxLoading ? "Loading…" : "Select activity type…"}
          </option>
          {activityTypes.data?.map((at) => (
            <option key={at.id} value={at.id}>
              {at.name}
            </option>
          ))}
        </SelectInput>
      </FormField>

      {/* Duration */}
      <FormField label="Duration (minutes)" error={errors.duration_minutes?.message}>
        <Controller
          name="duration_minutes"
          control={control}
          render={({ field }) => (
            <DurationInput
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.duration_minutes?.message}
            />
          )}
        />
      </FormField>

      {/* Notes */}
      <FormField label="Notes" error={errors.notes?.message}>
        <textarea
          rows={2}
          placeholder="Optional notes…"
          {...register("notes")}
          className={cn(
            "block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm resize-none",
            "focus:ring-1 focus:ring-brand-500 focus:border-brand-500",
            errors.notes ? "border-red-300" : "border-surface-300"
          )}
        />
      </FormField>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          disabled={isSubmitting || isLocked || isRefDataLoading}
          className="flex-1"
        >
          {isSubmitting
            ? "Saving…"
            : isEditing
              ? "Update Entry"
              : "Log Entry"}
        </Button>
        {isEditing && onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
