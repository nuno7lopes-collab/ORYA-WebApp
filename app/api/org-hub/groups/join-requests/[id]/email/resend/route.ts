import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { resendMembershipRequestEmails } from "@/lib/domain/groupGovernance";
import { failFromMessage } from "@/app/api/org-hub/groups/_shared";

async function _POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const result = await resendMembershipRequestEmails({
      requestId: id,
      kind: "JOIN",
      userId: user.id,
    });

    return respondOk(
      ctx,
      {
        request: {
          id: result.request.id,
          status: result.request.status,
          emailTokenExpiresAt: result.request.emailTokenExpiresAt,
        },
        sentTo: result.sentTo,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "INTERNAL_ERROR";
    return failFromMessage(message);
  }
}

export const POST = withApiEnvelope(_POST);
