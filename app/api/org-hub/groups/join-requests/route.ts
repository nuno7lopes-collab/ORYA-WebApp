import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { startJoinRequest } from "@/lib/domain/groupGovernance";
import { failFromMessage, requirePositiveInt } from "@/app/api/org-hub/groups/_shared";

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const groupId = requirePositiveInt(body?.groupId);
    const organizationId = requirePositiveInt(body?.organizationId);
    if (!groupId || !organizationId) {
      return failFromMessage("INVALID_BODY");
    }

    const request = await startJoinRequest({
      groupId,
      organizationId,
      userId: user.id,
    });

    return respondOk(
      ctx,
      {
        request: {
          id: request.id,
          status: request.status,
          type: request.type,
          groupId: request.groupId,
          organizationId: request.organizationId,
          expiresAt: request.expiresAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "INTERNAL_ERROR";
    return failFromMessage(message);
  }
}

export const POST = withApiEnvelope(_POST);
