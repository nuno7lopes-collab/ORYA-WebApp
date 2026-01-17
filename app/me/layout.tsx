export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ReactNode } from "react";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { AuthGate } from "@/app/components/autenticação/AuthGate";

export default async function MeLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  return <>{children}</>;
}
