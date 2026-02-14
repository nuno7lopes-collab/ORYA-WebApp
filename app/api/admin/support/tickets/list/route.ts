import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { listSupportTickets, supportTicketListQuerySchema } from "@/lib/domain/supportTickets";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, message: string) {
  return respondError(
    ctx,
    {
      errorCode: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR",
      message,
      retryable: status >= 500,
    },
    { status },
  );
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return fail(ctx, admin.status, admin.error);
    }

    const url = new URL(req.url);
    const parsed = supportTicketListQuerySchema.parse({
      status: url.searchParams.get("status") ?? "ALL",
      category: url.searchParams.get("category") ?? "ALL",
      q: url.searchParams.get("q") ?? "",
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
      page: url.searchParams.get("page") ?? "1",
      pageSize: url.searchParams.get("pageSize") ?? "25",
    });

    const result = await listSupportTickets(parsed);
    return respondOk(ctx, result, { status: 200 });
  } catch (err) {
    console.error("[admin/support/tickets/list][GET]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const GET = withApiEnvelope(_GET);
