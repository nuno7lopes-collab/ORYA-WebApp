import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    if (admin.error === "MFA_REQUIRED") {
      redirect("/admin/mfa");
    }
    if (admin.error === "FORBIDDEN") {
      redirect("/admin/forbidden");
    }
    redirect("/login?redirectTo=/admin");
  }

  return <>{children}</>;
}
