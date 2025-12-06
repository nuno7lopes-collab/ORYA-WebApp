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

  const { data: profile } = await supabase
    .from("profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
  const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");

  if (!isAdmin) {
    redirect("/em-breve");
  }

  return <>{children}</>;
}
