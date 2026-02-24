import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { createSupabaseServer } from "@/lib/supabaseServer";
import GroupGovernanceClient from "@/app/org/_internal/core/organizations/GroupGovernanceClient";
import { listOrgHubGroupsForUser } from "@/lib/orgHub/listGroupsForUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePositiveInt(raw: string | null | undefined) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

type GroupGovernancePageProps = {
  params: Promise<{ groupId: string }> | { groupId: string };
};

export default async function GroupGovernancePage({ params }: GroupGovernancePageProps) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const resolvedParams = await params;
  const groupId = parsePositiveInt(resolvedParams.groupId);

  if (!groupId) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">Grupo inválido.</div>
      </div>
    );
  }

  const groups = await listOrgHubGroupsForUser({ userId: user.id, groupId });
  const selectedGroup = groups.find((item) => item.groupId === groupId) ?? null;

  if (!selectedGroup) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          Sem permissões para gerir este grupo.
        </div>
      </div>
    );
  }

  return <GroupGovernanceClient group={selectedGroup} />;
}
