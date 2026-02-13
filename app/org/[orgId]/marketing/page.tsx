import DashboardClient from "@/app/organizacao/DashboardClient";

export default function OrgMarketingPage() {
  return <DashboardClient hasOrganization defaultObjective="promote" defaultSection="marketing" />;
}
