import DashboardClient from "@/app/org/_internal/core/DashboardClient";

export default async function OrgFinancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams: Record<string, string | string[] | undefined> =
    ((await Promise.resolve(searchParams)) ?? {}) as Record<string, string | string[] | undefined>;
  const readParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  const tab = readParam(resolvedSearchParams.tab);
  const sectionParam = readParam(resolvedSearchParams.section);
  const financeParam = readParam(resolvedSearchParams.finance);
  const section =
    sectionParam === "overview" || sectionParam === "financas" || sectionParam === "invoices" || sectionParam === "ops"
      ? sectionParam
      : tab === "overview"
        ? "overview"
        : tab === "invoices" || financeParam === "subscriptions"
          ? "invoices"
          : tab === "ops"
            ? "ops"
            : "financas";
  return <DashboardClient hasOrganization defaultObjective="analyze" defaultSection={section} />;
}
