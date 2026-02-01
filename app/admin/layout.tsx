import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminUser({ skipMfa: true });
  if (!admin.ok) {
    redirect("/login?redirectTo=/admin");
  }

  return <>{children}</>;
}
