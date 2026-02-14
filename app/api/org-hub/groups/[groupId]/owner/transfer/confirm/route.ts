import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { confirmGroupOwnerTransfer } from "@/lib/domain/groupGovernance";
import { failFromMessage, requirePositiveInt } from "@/app/api/org-hub/groups/_shared";

async function handleConfirm(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = requirePositiveInt(groupIdRaw);
    if (!groupId) {
      return failFromMessage("INVALID_BODY");
    }

    let token: string | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else {
      const body = await req.json().catch(() => null);
      token = typeof body?.token === "string" ? body.token : null;
    }

    if (!token || !token.trim()) {
      return failFromMessage("TOKEN_REQUIRED");
    }

    const transfer = await confirmGroupOwnerTransfer({
      groupId,
      actorUserId: user.id,
      token,
    });

    return respondOk(
      ctx,
      {
        transfer: {
          id: transfer.id,
          groupId: transfer.groupId,
          status: transfer.status,
          confirmedAt: transfer.confirmedAt,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "INTERNAL_ERROR";
    return failFromMessage(message);
  }
}

export const GET = withApiEnvelope(handleConfirm);
export const POST = withApiEnvelope(handleConfirm);
