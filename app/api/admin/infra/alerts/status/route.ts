import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { logError } from "@/lib/observability/logger";
import { runAwsCli } from "@/app/api/admin/infra/_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const identity = await runAwsCli(ctx, ["sts", "get-caller-identity"]);
    if (!identity.ok) {
      return fail(ctx, 500, "STS_FAILED", identity.error ?? "STS_FAILED");
    }
    const accountId = identity.data?.Account;
    if (!accountId) return fail(ctx, 500, "ACCOUNT_ID_MISSING");

    const budgetsRes = await runAwsCli(ctx, ["budgets", "describe-budgets", "--account-id", String(accountId)]);
    const budgets =
      budgetsRes.ok
        ? (budgetsRes.data?.Budgets ?? []).map((b: any) => ({
            name: b.BudgetName,
            limit: b.BudgetLimit?.Amount ?? "0",
            unit: b.BudgetLimit?.Unit ?? "USD",
            timeUnit: b.TimeUnit ?? "MONTHLY",
          }))
        : [];

    const alarmsRes = await runAwsCli(ctx, ["cloudwatch", "describe-alarms"]);
    const alarms =
      alarmsRes.ok
        ? (alarmsRes.data?.MetricAlarms ?? []).map((a: any) => ({
            name: a.AlarmName,
            state: a.StateValue,
            reason: a.StateReason,
          }))
        : [];

    return respondOk(ctx, { budgets, alarms });
  } catch (err) {
    logError("admin.infra.alerts_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
