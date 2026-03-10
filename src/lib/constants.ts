/** Role hierarchy — higher index = more permissions. */
export const ROLE_HIERARCHY = {
  viewer: 0,
  consultant: 1,
  manager: 2,
  admin: 3,
} as const;

export type UserRole = keyof typeof ROLE_HIERARCHY;

export const REPORTING_PERIOD_STATUSES = {
  draft: { label: "Draft", color: "gray" },
  in_review: { label: "In Review", color: "amber" },
  approved: { label: "Approved", color: "green" },
} as const;

export type PeriodStatus = keyof typeof REPORTING_PERIOD_STATUSES;

/** Number of recent entries to show on the dashboard. */
export const DASHBOARD_RECENT_DAYS = 7;

/** Default pagination page size. */
export const PAGE_SIZE = 25;

/** Max file size for CSV import (5MB). */
export const CSV_MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Required columns in customer import CSV. */
export const CSV_REQUIRED_COLUMNS = [
  "external_account_id",
  "name",
] as const;
