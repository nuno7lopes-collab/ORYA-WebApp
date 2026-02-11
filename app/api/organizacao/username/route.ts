export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { normalizeAndValidateUsername, setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _PATCH(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fail(401, "Não autenticado.");
    }

    const body = await req.json().catch(() => null);
    const usernameRaw = typeof body?.username === "string" ? body.username : "";
    const validated = normalizeAndValidateUsername(usernameRaw);
    if (!validated.ok) {
      return fail(400, validated.error);
    }
    const username = validated.username;

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER"],
    });
    if (!organization || !membership || !["OWNER", "CO_OWNER"].includes(membership.role)) {
      return fail(403, "Apenas Owner ou Co-owner podem alterar o username.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "USERNAME" });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.errorCode ?? "FORBIDDEN", message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
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

    return respondOk(ctx, { username }, { status: 200 });
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return fail(409, "Este username já está a ser usado.");
    }
    console.error("[organização/username][PATCH]", err);
    const isUnique = err instanceof Error && err.message.toLowerCase().includes("unique");
    const message = isUnique ? "Este username já está a ser usado." : "Erro ao atualizar username.";
    return fail(isUnique ? 409 : 500, message);
  }
}
export const PATCH = withApiEnvelope(_PATCH);
