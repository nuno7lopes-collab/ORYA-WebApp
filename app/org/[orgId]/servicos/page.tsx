import DashboardClient from "@/app/organizacao/DashboardClient";

export default function OrgServicesPage() {
  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="reservas" />;
}
