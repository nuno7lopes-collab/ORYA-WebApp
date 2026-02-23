export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  ensurePartnershipOrganization,
  isPartnershipTournamentRequestsTableMissingError,
} from "@/app/api/padel/partnerships/_shared";

type PartnershipTournamentRequestDelegate = {
  findUnique: (args: Record<string, unknown>) => Promise<any | null>;
  update: (args: Record<string, unknown>) => Promise<any>;
};

const partnershipTournamentRequestDelegate =
  (prisma as unknown as { padelPartnershipTournamentRequest?: PartnershipTournamentRequestDelegate })
    .padelPartnershipTournamentRequest ?? null;

async function _POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const check = await ensurePartnershipOrganization({ req, required: "EDIT", body });
  if (!check.ok) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }
  if (!partnershipTournamentRequestDelegate) {
    return jsonWrap({ ok: false, error: "PARTNERSHIP_REQUESTS_UNAVAILABLE" }, { status: 503 });
  }

  const requestId = readNumericParam(undefined, req, "request");
  if (requestId === null) {
    return jsonWrap({ ok: false, error: "INVALID_REQUEST_ID" }, { status: 400 });
  }

  try {
    const requestItem = await partnershipTournamentRequestDelegate.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        ownerOrganizationId: true,
        status: true,
        eventId: true,
      },
    });
    if (!requestItem) {
      return jsonWrap({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404 });
    }

    if (check.organization.id !== requestItem.ownerOrganizationId) {
      return jsonWrap({ ok: false, error: "ONLY_OWNER_CAN_REVIEW" }, { status: 403 });
    }

    if (requestItem.status !== "PENDING") {
      return jsonWrap({ ok: false, error: "REQUEST_NOT_PENDING" }, { status: 409 });
    }
    if (requestItem.eventId) {
      return jsonWrap({ ok: false, error: "REQUEST_ALREADY_CONSUMED" }, { status: 409 });
    }

    const updated = await partnershipTournamentRequestDelegate.update({
      where: { id: requestItem.id },
      data: {
        status: "REJECTED",
        reviewedByUserId: check.userId,
        reviewedAt: new Date(),
      },
    });

    return jsonWrap({ ok: true, request: updated }, { status: 200 });
  } catch (err) {
    if (isPartnershipTournamentRequestsTableMissingError(err)) {
      return jsonWrap({ ok: false, error: "PARTNERSHIP_REQUESTS_UNAVAILABLE" }, { status: 503 });
    }
    throw err;
  }
}

export const POST = withApiEnvelope(_POST);
