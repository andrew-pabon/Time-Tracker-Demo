import { useState, useRef, useEffect, useCallback } from "react";
import { parseCsvFile, type CsvParseResult, type CsvRow } from "@/lib/csv-parser";
import { useCustomerImport, type ImportResult } from "@/hooks/useCustomerImport";
import { useAdminCustomers } from "@/hooks/useAdminCustomers";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "select" | "preview" | "importing" | "results";

interface CsvUploadDialogProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CsvUploadDialog({ open, onClose }: CsvUploadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const importMutation = useCustomerImport();

  // Fetch existing customers to tag preview rows as "New" vs "Update"
  const { data: existingCustomers } = useAdminCustomers({
    includeArchived: true,
  });
  const existingIds = new Set(
    (existingCustomers ?? []).map((c) => c.external_account_id)
  );

  // Manage native dialog
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("select");
      setFileName("");
      setParseResult(null);
      setImportResult(null);
      setImportError(null);
    }
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current && step !== "importing") {
      onClose();
    }
  }

  // -------------------------------------------------------------------------
  // File selection
  // -------------------------------------------------------------------------

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const result = await parseCsvFile(file);
    setParseResult(result);
    setStep("preview");
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  // -------------------------------------------------------------------------
  // Import execution
  // -------------------------------------------------------------------------

  async function handleImport() {
    if (!parseResult || !parseResult.isValid) return;

    setStep("importing");
    setImportError(null);

    try {
      const result = await importMutation.mutateAsync({
        rows: parseResult.rows,
        fileName,
      });
      setImportResult(result);
      setStep("results");
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Import failed unexpectedly."
      );
      setStep("results");
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={() => step !== "importing" && onClose()}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-auto w-full max-w-2xl rounded-xl border border-surface-200 bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-surface-900">
          Import Customers from CSV
        </h3>
        {step !== "importing" && (
          <button
            onClick={onClose}
            className="rounded p-0.5 text-surface-400 hover:text-surface-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Body — step-based rendering */}
      <div className="px-5 py-4">
        {step === "select" && (
          <FileSelectStep
            fileInputRef={fileInputRef}
            onFileInput={handleFileInput}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
        )}

        {step === "preview" && parseResult && (
          <PreviewStep
            parseResult={parseResult}
            existingIds={existingIds}
            fileName={fileName}
          />
        )}

        {step === "importing" && <ImportingStep />}

        {step === "results" && (
          <ResultsStep
            importResult={importResult}
            importError={importError}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between border-t border-surface-100 px-5 py-3">
        <div>
          {step === "preview" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("select");
                setParseResult(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Choose Different File
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step !== "importing" && step !== "results" && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          )}

          {step === "preview" && parseResult?.isValid && (
            <Button size="sm" onClick={handleImport}>
              Import {parseResult.rows.length} Customer
              {parseResult.rows.length !== 1 && "s"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}

          {step === "results" && (
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Step 1: File selection
// ---------------------------------------------------------------------------

function FileSelectStep({
  fileInputRef,
  onFileInput,
  onDrop,
  onDragOver,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}) {
  return (
    <div>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-surface-300 bg-surface-50 px-6 py-10 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/30"
      >
        <Upload className="mb-3 h-8 w-8 text-surface-400" />
        <p className="text-sm font-medium text-surface-700">
          Drag and drop a CSV file here
        </p>
        <p className="mt-1 text-xs text-surface-400">or</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          Browse Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileInput}
          className="hidden"
        />
      </div>

      <div className="mt-4 rounded-lg bg-surface-50 px-4 py-3">
        <p className="text-xs font-medium text-surface-600 mb-1.5">
          Expected CSV format:
        </p>
        <code className="block rounded bg-surface-100 px-3 py-2 text-xs text-surface-700 font-mono">
          external_account_id,name{"\n"}
          ACC-001,Acme Corporation{"\n"}
          ACC-002,Globex Industries
        </code>
        <p className="mt-2 text-xs text-surface-400">
          Required columns: <strong>external_account_id</strong> and{" "}
          <strong>name</strong>. Extra columns are ignored. Max 5 MB.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Preview parsed data
// ---------------------------------------------------------------------------

function PreviewStep({
  parseResult,
  existingIds,
  fileName,
}: {
  parseResult: CsvParseResult;
  existingIds: Set<string>;
  fileName: string;
}) {
  const newCount = parseResult.rows.filter(
    (r) => !existingIds.has(r.external_account_id)
  ).length;
  const updateCount = parseResult.rows.filter((r) =>
    existingIds.has(r.external_account_id)
  ).length;

  return (
    <div>
      {/* File info */}
      <div className="mb-4 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-surface-400" />
        <span className="text-sm font-medium text-surface-700">
          {fileName}
        </span>
        <span className="text-xs text-surface-400">
          ({parseResult.totalRows} row{parseResult.totalRows !== 1 && "s"})
        </span>
      </div>

      {/* Validation summary */}
      <div className="mb-4 space-y-1.5">
        <ValidationLine
          ok={parseResult.errors.filter((e) => e.field === "external_account_id" && e.rowNumber === null).length === 0}
          label='Required column "external_account_id" present'
        />
        <ValidationLine
          ok={parseResult.errors.filter((e) => e.field === "name" && e.rowNumber === null).length === 0}
          label='Required column "name" present'
        />
        <ValidationLine
          ok={parseResult.errors.filter((e) => e.rowNumber !== null).length === 0}
          label={`${parseResult.rows.length} valid rows`}
        />
        {parseResult.isValid && (
          <div className="flex items-center gap-3 text-xs text-surface-500 pt-1">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
              {newCount} new
            </span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
              {updateCount} update{updateCount !== 1 && "s"}
            </span>
          </div>
        )}
      </div>

      {/* Errors */}
      {parseResult.errors.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-800 mb-1.5">
            {parseResult.errors.length} error
            {parseResult.errors.length !== 1 && "s"} found — fix these and
            re-upload:
          </p>
          <ul className="space-y-0.5 max-h-32 overflow-y-auto">
            {parseResult.errors.map((err, i) => (
              <li key={i} className="text-xs text-red-700">
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview table */}
      {parseResult.rows.length > 0 && (
        <div className="rounded-lg border border-surface-200 overflow-hidden">
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-50">
                <tr className="border-b border-surface-100 text-left">
                  <th className="px-3 py-2 font-medium text-surface-500 w-10">
                    #
                  </th>
                  <th className="px-3 py-2 font-medium text-surface-500">
                    External Account ID
                  </th>
                  <th className="px-3 py-2 font-medium text-surface-500">
                    Name
                  </th>
                  <th className="px-3 py-2 font-medium text-surface-500 w-20">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {parseResult.rows.map((row) => {
                  const isUpdate = existingIds.has(row.external_account_id);
                  return (
                    <tr
                      key={row.rowNumber}
                      className="border-b border-surface-50"
                    >
                      <td className="px-3 py-1.5 text-surface-400 tabular-nums">
                        {row.rowNumber}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-surface-600">
                        {row.external_account_id}
                      </td>
                      <td className="px-3 py-1.5 text-surface-700">
                        {row.name}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            isUpdate
                              ? "bg-brand-50 text-brand-700"
                              : "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          {isUpdate ? "Update" : "New"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {parseResult.rows.length > 10 && (
            <div className="border-t border-surface-100 bg-surface-50 px-3 py-1.5 text-xs text-surface-400 text-center">
              Showing all {parseResult.rows.length} rows (scroll to see more)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ValidationLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-500" />
      )}
      <span className={ok ? "text-surface-600" : "text-red-700"}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Importing spinner
// ---------------------------------------------------------------------------

function ImportingStep() {
  return (
    <div className="flex flex-col items-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-200 border-t-brand-600" />
      <p className="mt-3 text-sm font-medium text-surface-700">
        Importing customers…
      </p>
      <p className="mt-1 text-xs text-surface-400">
        This may take a few seconds.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Results summary
// ---------------------------------------------------------------------------

function ResultsStep({
  importResult,
  importError,
}: {
  importResult: ImportResult | null;
  importError: string | null;
}) {
  if (importError) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <XCircle className="h-6 w-6 text-red-500" />
        </div>
        <p className="text-sm font-semibold text-surface-900">Import Failed</p>
        <p className="mt-1 max-w-sm text-center text-sm text-surface-500">
          {importError}
        </p>
      </div>
    );
  }

  if (!importResult) return null;

  const total = importResult.inserted + importResult.updated;

  return (
    <div className="flex flex-col items-center py-6">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>
      <p className="text-sm font-semibold text-surface-900">
        Import Complete
      </p>
      <p className="mt-1 text-sm text-surface-500">
        {total} customer{total !== 1 && "s"} processed successfully.
      </p>

      {/* Breakdown */}
      <div className="mt-4 flex gap-4">
        <StatCard label="Created" value={importResult.inserted} color="emerald" />
        <StatCard label="Updated" value={importResult.updated} color="brand" />
        {importResult.failed > 0 && (
          <StatCard label="Failed" value={importResult.failed} color="red" />
        )}
      </div>

      {/* Per-row errors */}
      {importResult.errors.length > 0 && (
        <div className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-800 mb-1">
            Row-level errors:
          </p>
          <ul className="space-y-0.5 max-h-24 overflow-y-auto">
            {importResult.errors.map((err, i) => (
              <li key={i} className="text-xs text-red-700">
                Row {err.rowNumber}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "brand" | "red";
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    brand: "bg-brand-50 text-brand-800 border-brand-200",
    red: "bg-red-50 text-red-800 border-red-200",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border px-5 py-3",
        colorMap[color]
      )}
    >
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-xs font-medium opacity-70">{label}</span>
    </div>
  );
}
