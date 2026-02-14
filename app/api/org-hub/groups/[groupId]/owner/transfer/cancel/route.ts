import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { cancelGroupOwnerTransfer } from "@/lib/domain/groupGovernance";
import { failFromMessage, requirePositiveInt } from "@/app/api/org-hub/groups/_shared";

async function _POST(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = requirePositiveInt(groupIdRaw);
    const body = await req.json().catch(() => null);
    const transferId = typeof body?.transferId === "string" ? body.transferId.trim() : "";
    if (!groupId || !transferId) {
      return failFromMessage("INVALID_BODY");
    }

    const transfer = await cancelGroupOwnerTransfer({
      groupId,
      actorUserId: user.id,
      transferId,
    });

    return respondOk(
      ctx,
      {
        transfer: {
          id: transfer.id,
          groupId: transfer.groupId,
          status: transfer.status,
          cancelledAt: transfer.cancelledAt,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "INTERNAL_ERROR";
    return failFromMessage(message);
  }
}

export const POST = withApiEnvelope(_POST);
