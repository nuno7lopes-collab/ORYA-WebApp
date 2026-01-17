import { createSupabaseServer } from "@/lib/supabaseServer";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import OrganizationInvitesClient from "./OrganizationInvitesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = {
  invite?: string;
  inviteId?: string;
  token?: string;
};

export default async function OrganizationInvitesPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  return <OrganizationInvitesClient initialInviteId={searchParams.invite ?? searchParams.inviteId ?? null} initialToken={searchParams.token ?? null} />;
}
