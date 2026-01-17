export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { AuthGate } from "@/app/components/autenticação/AuthGate";

/**
 * Layout minimal para /organizacao: apenas garante que o utilizador está autenticado.
 * O shell do dashboard vive em app/organizacao/(dashboard)/layout.tsx.
 */
export default async function OrganizationLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  return <>{children}</>;
}
