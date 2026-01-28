export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const usernameRaw = typeof body?.username === "string" ? body.username : "";
    const validated = normalizeAndValidateUsername(usernameRaw);
    if (!validated.ok) {
      return jsonWrap({ ok: false, error: validated.error }, { status: 400 });
    }
    const username = validated.username;

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER"],
    });
    if (!organization || !membership || !["OWNER", "CO_OWNER"].includes(membership.role)) {
      return jsonWrap(
        { ok: false, error: "Apenas Owner ou Co-owner podem alterar o username." },
        { status: 403 },
      );
    }
    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return jsonWrap({ ok: false, error: emailGate.error }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await setUsernameForOwner({
        username,
        ownerType: "organization",
        ownerId: organization.id,
        tx,
      });
      await tx.organization.update({
        where: { id: organization.id },
        data: { username },
      });
    });

    return jsonWrap({ ok: true, username }, { status: 200 });
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return jsonWrap({ ok: false, error: "Este username já está a ser usado." }, { status: 409 });
    }
    console.error("[organização/username][PATCH]", err);
    const isUnique = err instanceof Error && err.message.toLowerCase().includes("unique");
    const message = isUnique ? "Este username já está a ser usado." : "Erro ao atualizar username.";
    return jsonWrap({ ok: false, error: message }, { status: isUnique ? 409 : 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);