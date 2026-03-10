import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaxonomyPanel } from "@/components/admin/TaxonomyPanel";
import { cn } from "@/lib/utils";
import type { TaxonomyTable } from "@/hooks/useAdminTaxonomy";

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

interface TabConfig {
  key: TaxonomyTable;
  label: string;
  singularLabel: string;
}

const TABS: TabConfig[] = [
  {
    key: "service_lines",
    label: "Service Lines",
    singularLabel: "Service Line",
  },
  {
    key: "workstreams",
    label: "Workstreams",
    singularLabel: "Workstream",
  },
  {
    key: "activity_types",
    label: "Activity Types",
    singularLabel: "Activity Type",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AdminCategoriesPage() {
  const [activeTab, setActiveTab] = useState<TaxonomyTable>("service_lines");
  const [showArchived, setShowArchived] = useState(false);

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  return (
    <>
      <PageHeader
        title="Categories"
        description="Manage the taxonomy used for time tracking."
      />

      {/* Tabs */}
      <div className="mb-4 border-b border-surface-200">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Show Archived toggle */}
      <div className="mb-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-surface-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
          />
          Show Archived
        </label>
      </div>

      {/* Taxonomy panel — the key prop forces a fresh mount when switching tabs */}
      <TaxonomyPanel
        key={currentTab.key}
        table={currentTab.key}
        singularLabel={currentTab.singularLabel}
        showArchived={showArchived}
      />
    </>
  );
}
