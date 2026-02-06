export const runtime = "nodejs";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser, ORG_CONTEXT_UI } from "@/lib/organizationContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { cn } from "@/lib/utils";
import { OrganizationMemberRole } from "@prisma/client";
import ChatPreviewClient from "./preview/ChatPreviewClient";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

export default async function OrganizationChatPage() {
  const { user } = await getCurrentUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, ORG_CONTEXT_UI);
  const allowedRoles = new Set<OrganizationMemberRole>([
    OrganizationMemberRole.OWNER,
    OrganizationMemberRole.CO_OWNER,
    OrganizationMemberRole.ADMIN,
    OrganizationMemberRole.STAFF,
    OrganizationMemberRole.TRAINER,
  ]);

  if (!organization || !membership || !allowedRoles.has(membership.role)) {
    const target = appendOrganizationIdToHref("/organizacao/organizations", organization?.id ?? null);
    redirect(target);
  }

  const modulesRows = await prisma.organizationModuleEntry.findMany({
    where: { organizationId: organization.id, enabled: true },
    select: { moduleKey: true },
    orderBy: { moduleKey: "asc" },
  });
  const enabledModules = new Set(
    modulesRows
      .map((row) => row.moduleKey)
      .filter((module) => typeof module === "string")
      .map((module) => module.trim().toUpperCase())
      .filter((module) => module.length > 0),
  );

  if (!enabledModules.has("MENSAGENS")) {
    return (
      <div className={cn("w-full space-y-4 py-8 text-white")}>
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Chat interno</p>
          <h1 className="text-2xl font-semibold">Módulo desativado</h1>
          <p className="text-sm text-white/70">
            Ativa o módulo nas apps da organização para começares a usar o chat interno.
          </p>
          <Link
            href={appendOrganizationIdToHref("/organizacao/overview?section=modulos", organization.id)}
            className={`${CTA_SECONDARY} mt-4 text-[12px]`}
          >
            Gerir apps
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full min-h-0 w-full text-white")}>
      <ChatPreviewClient />
    </div>
  );
}
