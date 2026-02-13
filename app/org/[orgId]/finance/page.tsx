import DashboardClient from "@/app/organizacao/DashboardClient";

export default async function OrgFinancePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams: Record<string, string | string[] | undefined> =
    ((await Promise.resolve(searchParams)) ?? {}) as Record<string, string | string[] | undefined>;
  const tabRaw = resolvedSearchParams.tab;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const section = tab === "invoices" ? "invoices" : "financas";
  return <DashboardClient hasOrganization defaultObjective="analyze" defaultSection={section} />;
}
