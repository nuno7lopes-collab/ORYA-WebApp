import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";

export async function POST(_req: NextRequest, _params: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(_req);
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return respondError(
      ctx,
      { errorCode: auth.error, message: auth.error, retryable: false },
      { status: auth.status },
    );
  }

  return respondError(
    ctx,
    { errorCode: "PAYOUT_CONTROL_DISABLED", message: "Payouts são controlados pelo Stripe.", retryable: false },
    { status: 409 },
  );
}
