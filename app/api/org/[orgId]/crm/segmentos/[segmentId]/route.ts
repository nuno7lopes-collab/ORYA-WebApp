import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { CrmSegmentStatus, OrganizationMemberRole, Prisma } from "@prisma/client";
import { normalizeSegmentDefinition } from "@/lib/crm/segments";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const READ_ROLES = Object.values(OrganizationMemberRole);

async function _GET(req: NextRequest, context: { params: Promise<{ segmentId: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
    if (!orgResolution.ok) {
      return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
    }
    const organizationId = orgResolution.organizationId;
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const resolvedParams = await context.params;
    const segmentId = resolvedParams.segmentId;
    const segment = await prisma.crmSegment.findFirst({
      where: { id: segmentId, organizationId: organization.id },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        rules: true,
        sizeCache: true,
        lastComputedAt: true,
      },
    });

    if (!segment) {
      return jsonWrap({ ok: false, error: "Segmento não encontrado." }, { status: 404 });
    }

    return jsonWrap({
      ok: true,
      segment: {
        ...segment,
        definition: segment.rules,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/org/[orgId]/crm/segmentos/[segmentId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar segmento." }, { status: 500 });
  }
}

async function _PATCH(req: NextRequest, context: { params: Promise<{ segmentId: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
    if (!orgResolution.ok) {
      return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
    }
    const organizationId = orgResolution.organizationId;
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId,
      roles: [...READ_ROLES],
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "CRM_SEGMENTS" });
    if (!emailGate.ok) {
      return jsonWrap({ ok: false, error: emailGate.errorCode ?? "FORBIDDEN" }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const resolvedParams = await context.params;
    const segmentId = resolvedParams.segmentId;
    const existing = await prisma.crmSegment.findFirst({
      where: { id: segmentId, organizationId: organization.id },
      select: { id: true, rules: true, status: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Segmento não encontrado." }, { status: 404 });
    }

    const payload = (await req.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
      status?: unknown;
      definition?: unknown;
      rules?: unknown;
    } | null;

    const updateData: Prisma.CrmSegmentUpdateInput = {};
    if (typeof payload?.name === "string") {
      const name = payload.name.trim();
      if (name.length < 2) {
        return jsonWrap({ ok: false, error: "Nome inválido." }, { status: 400 });
      }
      updateData.name = name;
    }
    if (typeof payload?.description === "string" || payload?.description === null) {
      updateData.description = typeof payload.description === "string" ? payload.description.trim() : null;
    }
    if (typeof payload?.status === "string") {
      const status = payload.status.trim().toUpperCase();
      if (!(Object.values(CrmSegmentStatus) as string[]).includes(status)) {
        return jsonWrap({ ok: false, error: "Status inválido." }, { status: 400 });
      }
      updateData.status = status as CrmSegmentStatus;
    }
    if (
      payload &&
      (Object.prototype.hasOwnProperty.call(payload, "definition") ||
        Object.prototype.hasOwnProperty.call(payload, "rules"))
    ) {
      const definition = normalizeSegmentDefinition(payload.definition ?? payload.rules ?? existing.rules);
      if (!definition.root.children.length) {
        return jsonWrap({ ok: false, error: "Segmento sem regras. Define pelo menos uma condição." }, { status: 400 });
      }
      updateData.rules = definition as Prisma.InputJsonValue;
      updateData.lastComputedAt = null;
    }

    if (!Object.keys(updateData).length) {
      return jsonWrap({ ok: true, segment: { id: existing.id, definition: existing.rules } });
    }

    const segment = await prisma.crmSegment.update({
      where: { id: existing.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        rules: true,
        sizeCache: true,
        lastComputedAt: true,
        updatedAt: true,
      },
    });

    return jsonWrap({
      ok: true,
      segment: {
        ...segment,
        definition: segment.rules,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("PATCH /api/org/[orgId]/crm/segmentos/[segmentId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar segmento." }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest, context: { params: Promise<{ segmentId: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
    if (!orgResolution.ok) {
      return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
    }
    const organizationId = orgResolution.organizationId;
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId,
      roles: [...READ_ROLES],
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "CRM_SEGMENTS" });
    if (!emailGate.ok) {
      return jsonWrap({ ok: false, error: emailGate.errorCode ?? "FORBIDDEN" }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const { segmentId } = await context.params;
    const existing = await prisma.crmSegment.findFirst({
      where: { id: segmentId, organizationId: organization.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Segmento não encontrado." }, { status: 404 });
    }

    const segment = await prisma.crmSegment.update({
      where: { id: existing.id },
      data: { status: CrmSegmentStatus.ARCHIVED },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });

    return jsonWrap({ ok: true, segment });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("DELETE /api/org/[orgId]/crm/segmentos/[segmentId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao arquivar segmento." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
