export const runtime = "nodejs";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { cn } from "@/lib/utils";
import { OrganizationStatus } from "@prisma/client";
import MensagensClient from "./MensagensClient";

export default async function OrganizationMensagensPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  if (!organization) {
    redirect("/organizacao/organizations");
  }

  const modulesRows = await prisma.organizationModuleEntry.findMany({
    where: { organizationId: organization.id, enabled: true },
    select: { moduleKey: true },
    orderBy: { moduleKey: "asc" },
  });
  const enabledModules = new Set(
    modulesRows
      .map((row) => row.moduleKey)
      .filter((module): module is string => typeof module === "string")
      .map((module) => module.trim().toUpperCase())
      .filter((module) => module.length > 0),
  );

  if (!enabledModules.has("MENSAGENS")) {
    return (
      <div className={cn("w-full space-y-4 py-8 text-white")}>
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Mensagens</p>
          <h1 className="text-2xl font-semibold">Módulo desativado</h1>
          <p className="text-sm text-white/70">
            Ativa o módulo nas apps da organização para começares a enviar comunicações.
          </p>
          <Link href="/organizacao?tab=overview&section=modulos" className={`${CTA_SECONDARY} mt-4 text-[12px]`}>
            Gerir apps
          </Link>
        </div>
      </div>
    );
  }

  return (
      <div className={cn("w-full space-y-6 py-8 text-white")}>
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Mensagens</p>
        <h1 className="text-2xl font-semibold">Mensagens</h1>
      </div>

      <MensagensClient />
    </div>
  );
}
