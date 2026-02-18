import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { createSupabaseServer } from "@/lib/supabaseServer";
import GroupsHubClient from "@/app/org/_internal/core/organizations/GroupsHubClient";
import { listOrgHubGroupsForUser } from "@/lib/orgHub/listGroupsForUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OrgHubGroupsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const groups = await listOrgHubGroupsForUser({ userId: user.id });

  return <GroupsHubClient initialGroups={groups} />;
}
