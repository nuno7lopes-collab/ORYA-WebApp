import type { ReactNode } from "react";
import OrganizationAuthLayout from "@/app/organizacao/layout";
import OrganizationDashboardLayout from "@/app/organizacao/(dashboard)/layout";

export default async function OrgScopedLayout({ children }: { children: ReactNode }) {
  return (
    <OrganizationAuthLayout>
      <OrganizationDashboardLayout>{children}</OrganizationDashboardLayout>
    </OrganizationAuthLayout>
  );
}
