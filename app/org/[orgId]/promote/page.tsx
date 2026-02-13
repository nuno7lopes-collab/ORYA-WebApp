import DashboardClient from "@/app/organizacao/DashboardClient";

export default async function OrgPromotePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const section = typeof searchParams?.section === "string" ? searchParams.section : "marketing";
  return <DashboardClient hasOrganization defaultObjective="promote" defaultSection={section} />;
}
