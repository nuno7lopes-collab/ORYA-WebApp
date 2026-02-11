import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { logAccountEvent } from "@/lib/accountEvents";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { DsarCaseStatus, DsarCaseType } from "@prisma/client";
import {
  countEffectiveOrganizationMembersByRole,
  listEffectiveOrganizationMembershipsForUser,
} from "@/lib/organizationMembers";

async function _POST() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    // Verificar se o utilizador é owner único de alguma organização
    const ownerMemberships = await listEffectiveOrganizationMembershipsForUser({
      userId: user.id,
      roles: ["OWNER"],
    });

    const blockedOrgs: string[] = [];
    for (const mem of ownerMemberships) {
      const otherOwners = await countEffectiveOrganizationMembersByRole({
        organizationId: mem.organizationId,
        role: "OWNER",
        excludeUserId: user.id,
      });
      if (otherOwners === 0) {
        blockedOrgs.push(
          mem.organization.publicName ||
            mem.organization.businessName ||
            `Organização #${mem.organizationId}`,
        );
      }
    }

    if (blockedOrgs.length > 0) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Ainda és o único proprietário destas organizações. Transfere a propriedade ou apaga-as antes de eliminar a conta.",
          organizations: blockedOrgs,
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const scheduled = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.profile.update({
      where: { id: user.id },
      data: {
        status: "PENDING_DELETE",
        deletionRequestedAt: now,
        deletionScheduledFor: scheduled,
        visibility: "PRIVATE",
      },
    });

    const existingCase = await prisma.dsarCase.findFirst({
      where: {
        userId: user.id,
        type: DsarCaseType.DELETE,
        status: { in: [DsarCaseStatus.REQUESTED, DsarCaseStatus.IN_PROGRESS] },
      },
      orderBy: { requestedAt: "desc" },
      select: { id: true },
    });

    if (existingCase) {
      await prisma.dsarCase.update({
        where: { id: existingCase.id },
        data: {
          status: DsarCaseStatus.REQUESTED,
          dueAt: scheduled,
          metadata: {
            action: "account_delete_requested",
            scheduledFor: scheduled.toISOString(),
          },
        },
      });
    } else {
      await prisma.dsarCase.create({
        data: {
          userId: user.id,
          type: DsarCaseType.DELETE,
          status: DsarCaseStatus.REQUESTED,
          requestedAt: now,
          dueAt: scheduled,
          metadata: {
            action: "account_delete_requested",
            scheduledFor: scheduled.toISOString(),
          },
        },
      });
    }

    await logAccountEvent({
      userId: user.id,
      type: "account_delete_requested",
      metadata: { scheduledFor: scheduled },
    });

    await supabase.auth.signOut();

    return jsonWrap({
      ok: true,
      status: "PENDING_DELETE",
      scheduledFor: scheduled.toISOString(),
      message: "Conta marcada para eliminação. Podes reverter dentro do prazo ao voltar a iniciar sessão.",
    });
  } catch (err) {
    console.error("[settings/delete] erro:", err);
    return jsonWrap(
      {
        ok: true,
        status: "ERROR",
        warning: "Não foi possível marcar para eliminação. Tenta novamente mais tarde.",
      },
      { status: 200 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
