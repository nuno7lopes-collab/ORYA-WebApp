export const runtime = "nodejs";

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { OrganizerShell } from "@/app/organizador/OrganizerShell";
import { getOrganizerShellData } from "@/app/organizador/organizerShellData";

export default async function OrganizerEventCreateLayout({ children }: { children: ReactNode }) {
  const shell = await getOrganizerShellData();
  if (!shell) {
    redirect("/login?next=/organizador");
  }

  return (
    <OrganizerShell
      organizerLanguage={shell.organizerLanguage}
      organizerUsername={shell.organizerUsername ?? null}
      brandPrimary={shell.brandPrimary}
      brandSecondary={shell.brandSecondary}
      sidebar={
        <AppSidebar
          activeOrg={shell.activeOrgLite}
          orgOptions={shell.orgOptions}
          user={shell.userInfo}
        />
      }
    >
      {children}
    </OrganizerShell>
  );
}
