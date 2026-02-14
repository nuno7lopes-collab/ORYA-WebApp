import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { generateMembershipRequestCode } from "@/lib/domain/groupGovernance";
import { failFromMessage } from "@/app/api/org-hub/groups/_shared";

async function _POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await req.json().catch(() => null);

    const result = await generateMembershipRequestCode({
      requestId: id,
      userId: user.id,
      participantHint: body?.participant,
      kind: "JOIN",
    });

    return respondOk(ctx, result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "INTERNAL_ERROR";
    return failFromMessage(message);
  }
}

export const POST = withApiEnvelope(_POST);
