export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * Layout minimal para /organizacao: apenas garante que o utilizador está autenticado.
 * O shell do dashboard (sidebar/topbar) vive em app/organizacao/(dashboard)/layout.tsx.
 */
export default async function OrganizationLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/organizacao");
  }

  return <>{children}</>;
}
