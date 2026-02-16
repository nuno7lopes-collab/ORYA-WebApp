export const ANALYTICS_ALLOWED_VIEWS = [
  "overview",
  "conversion",
  "cohorts",
  "buyers",
  "time-series",
  "dimensions",
] as const;

export const FINANCE_ALLOWED_VIEWS = [
  "overview",
  "invoicing",
  "payouts",
  "refunds-disputes",
  "reconciliation",
  "ledger",
  "exports",
  "ops",
] as const;

export const POLICIES_ALLOWED_VIEWS = [
  "overview",
  "booking",
  "terms",
  "guardrails",
] as const;

export const LEGACY_REMOVED_QUERY_KEYS = [
  "tab",
  "section",
  "analytics",
  "finance",
] as const;

export const LEGACY_REMOVED_ANALYZE_SECTIONS = [
  "overview",
  "vendas",
  "financas",
  "invoices",
  "ops",
] as const;

export type AnalyticsAllowedView = (typeof ANALYTICS_ALLOWED_VIEWS)[number];
export type FinanceAllowedView = (typeof FINANCE_ALLOWED_VIEWS)[number];
export type PoliciesAllowedView = (typeof POLICIES_ALLOWED_VIEWS)[number];

const ANALYTICS_ALLOWED_VIEW_SET = new Set<string>(ANALYTICS_ALLOWED_VIEWS);
const FINANCE_ALLOWED_VIEW_SET = new Set<string>(FINANCE_ALLOWED_VIEWS);
const POLICIES_ALLOWED_VIEW_SET = new Set<string>(POLICIES_ALLOWED_VIEWS);
const LEGACY_REMOVED_QUERY_KEY_SET = new Set<string>(LEGACY_REMOVED_QUERY_KEYS);
const LEGACY_REMOVED_ANALYZE_SECTION_SET = new Set<string>(LEGACY_REMOVED_ANALYZE_SECTIONS);

export function isAnalyticsAllowedView(value: string | null | undefined): value is AnalyticsAllowedView {
  return typeof value === "string" && ANALYTICS_ALLOWED_VIEW_SET.has(value);
}

export function isFinanceAllowedView(value: string | null | undefined): value is FinanceAllowedView {
  return typeof value === "string" && FINANCE_ALLOWED_VIEW_SET.has(value);
}

export function isPoliciesAllowedView(value: string | null | undefined): value is PoliciesAllowedView {
  return typeof value === "string" && POLICIES_ALLOWED_VIEW_SET.has(value);
}

export function hasLegacyRemovedQueryKeys(searchParams: URLSearchParams) {
  for (const key of searchParams.keys()) {
    if (LEGACY_REMOVED_QUERY_KEY_SET.has(key)) return true;
  }
  return false;
}

export function hasLegacyAnalyzeSections(searchParams: URLSearchParams) {
  const section = searchParams.get("section");
  if (!section) return false;
  return LEGACY_REMOVED_ANALYZE_SECTION_SET.has(section);
}
