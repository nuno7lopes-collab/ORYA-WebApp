import DashboardClient from "@/app/organizacao/DashboardClient";

export default function OrgBookingsPage() {
  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="reservas" />;
}
