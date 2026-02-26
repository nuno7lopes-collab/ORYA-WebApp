import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import CommunityInviteLandingClient from "@/app/messages/community-invite/[token]/CommunityInviteLandingClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CommunityInviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const resolvedParams = await params;
  const token = (resolvedParams.token ?? "").trim();
  if (!token) {
    notFound();
  }

  const invitePath = `/messages/community-invite/${encodeURIComponent(token)}`;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <CommunityInviteLandingClient
      token={token}
      invitePath={invitePath}
      isAuthenticated={Boolean(user)}
    />
  );
}
