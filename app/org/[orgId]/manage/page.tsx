import DashboardClient from "@/app/organizacao/DashboardClient";

export default async function OrgManagePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const section = typeof searchParams?.section === "string" ? searchParams.section : "eventos";
  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection={section} />;
}
