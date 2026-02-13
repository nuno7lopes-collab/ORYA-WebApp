export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { PadelPartnershipCompensationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensurePartnershipOrganization, parsePositiveInt } from "@/app/api/padel/partnerships/_shared";

const STATUS_SET = new Set<PadelPartnershipCompensationStatus>([
  "OPEN",
  "AUTO_RESOLVED",
  "PENDING_COMPENSATION",
  "MANUAL_RESOLVED",
  "CANCELLED",
]);

async function _GET(req: NextRequest) {
  const check = await ensurePartnershipOrganization({ req, required: "VIEW" });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const statusRaw = req.nextUrl.searchParams.get("status");
  const status = statusRaw ? statusRaw.trim().toUpperCase() : null;
  if (status && !STATUS_SET.has(status as PadelPartnershipCompensationStatus)) {
    return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 400 });
  }
  const agreementId = parsePositiveInt(req.nextUrl.searchParams.get("agreementId"));

  const items = await prisma.padelPartnershipCompensationCase.findMany({
    where: {
      OR: [
        { ownerOrganizationId: check.organization.id },
        { partnerOrganizationId: check.organization.id },
      ],
      ...(status ? { status: status as PadelPartnershipCompensationStatus } : {}),
      ...(agreementId ? { agreementId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 300,
  });

  return jsonWrap({ ok: true, items }, { status: 200 });
}

async function _PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const check = await ensurePartnershipOrganization({ req, required: "EDIT", body });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const caseId = parsePositiveInt(body.caseId ?? body.id);
  if (!caseId) return jsonWrap({ ok: false, error: "CASE_ID_REQUIRED" }, { status: 400 });

  const existing = await prisma.padelPartnershipCompensationCase.findFirst({
    where: {
      id: caseId,
      OR: [
        { ownerOrganizationId: check.organization.id },
        { partnerOrganizationId: check.organization.id },
      ],
    },
    select: {
      id: true,
      status: true,
      metadata: true,
      ownerOrganizationId: true,
      partnerOrganizationId: true,
    },
  });
  if (!existing) return jsonWrap({ ok: false, error: "CASE_NOT_FOUND" }, { status: 404 });

  const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const nextStatus = STATUS_SET.has(statusRaw as PadelPartnershipCompensationStatus)
    ? (statusRaw as PadelPartnershipCompensationStatus)
    : existing.status;
  const now = new Date();

  const metadataPatch =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const previousMetadata =
    existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const item = await prisma.padelPartnershipCompensationCase.update({
    where: { id: existing.id },
    data: {
      status: nextStatus,
      metadata: {
        ...previousMetadata,
        ...metadataPatch,
        ...(note ? { operatorNote: note } : {}),
      },
      resolvedByUserId:
        nextStatus === "MANUAL_RESOLVED" || nextStatus === "AUTO_RESOLVED" || nextStatus === "CANCELLED"
          ? check.userId
          : null,
      resolvedAt:
        nextStatus === "MANUAL_RESOLVED" || nextStatus === "AUTO_RESOLVED" || nextStatus === "CANCELLED"
          ? now
          : null,
    },
  });

  return jsonWrap({ ok: true, item }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);

