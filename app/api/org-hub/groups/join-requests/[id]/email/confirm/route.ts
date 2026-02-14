import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireUser } from "@/lib/auth/requireUser";
import { confirmMembershipRequestEmailToken } from "@/lib/domain/groupGovernance";
import { failFromMessage } from "@/app/api/org-hub/groups/_shared";

async function handleConfirm(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { id } = await context.params;

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

    const result = await confirmMembershipRequestEmailToken({
      requestId: id,
      kind: "JOIN",
      token: token.trim(),
      userId: user.id,
    });

    return respondOk(
      ctx,
      {
        request: {
          id,
          status: result.status,
          completed: result.completed,
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
