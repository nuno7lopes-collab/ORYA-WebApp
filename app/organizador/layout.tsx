export const runtime = "nodejs";

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";

/**
 * Layout minimal para /organizador: apenas garante que o utilizador está autenticado.
 * O shell do dashboard (sidebar/topbar) vive em app/organizador/(dashboard)/layout.tsx.
 */
export default async function OrganizerLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/organizador");
  }

  return <>{children}</>;
}
