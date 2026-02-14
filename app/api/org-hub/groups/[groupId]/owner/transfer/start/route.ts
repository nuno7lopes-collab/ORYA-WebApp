import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { startGroupOwnerTransfer } from "@/lib/domain/groupGovernance";
import { failFromMessage, requirePositiveInt } from "@/app/api/org-hub/groups/_shared";

async function _POST(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = requirePositiveInt(groupIdRaw);
    const body = await req.json().catch(() => null);
    const targetUserIdentifier = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";

    if (!groupId || !targetUserIdentifier) {
      return failFromMessage("INVALID_BODY");
    }

    const transfer = await startGroupOwnerTransfer({
      groupId,
      actorUserId: user.id,
      targetUserIdentifier,
    });

    return respondOk(
      ctx,
      {
        transfer: {
          id: transfer.id,
          groupId: transfer.groupId,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          status: transfer.status,
          expiresAt: transfer.expiresAt,
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
