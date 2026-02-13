import DashboardClient from "@/app/organizacao/DashboardClient";

export default async function OrgAnalyticsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tabRaw = searchParams?.tab;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const section = tab === "vendas" || tab === "ops" ? tab : "overview";
  return <DashboardClient hasOrganization defaultObjective="analyze" defaultSection={section} />;
}
