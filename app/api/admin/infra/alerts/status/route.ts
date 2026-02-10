import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { logError } from "@/lib/observability/logger";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { BudgetsClient, DescribeBudgetsCommand } from "@aws-sdk/client-budgets";
import { CloudWatchClient, DescribeAlarmsCommand } from "@aws-sdk/client-cloudwatch";
import { getAwsConfig } from "@/lib/awsSdk";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const stsClient = new STSClient(getAwsConfig());
    const budgetsClient = new BudgetsClient({ ...getAwsConfig(), region: "us-east-1" });
    const cwClient = new CloudWatchClient(getAwsConfig());

    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    const accountId = identity.Account;
    if (!accountId) return fail(ctx, 500, "ACCOUNT_ID_MISSING");

    const budgetsRes = await budgetsClient.send(
      new DescribeBudgetsCommand({ AccountId: String(accountId) }),
    );
    const rawBudgets = (budgetsRes.Budgets ?? []) as Array<{
      BudgetName?: string | null;
      BudgetLimit?: { Amount?: string | null; Unit?: string | null } | null;
      TimeUnit?: string | null;
    }>;
    const budgets = rawBudgets.map((b) => ({
      name: b.BudgetName ?? "",
      limit: b.BudgetLimit?.Amount ?? "0",
      unit: b.BudgetLimit?.Unit ?? "USD",
      timeUnit: b.TimeUnit ?? "MONTHLY",
    }));

    const alarmsRes = await cwClient.send(new DescribeAlarmsCommand({}));
    const rawAlarms = (alarmsRes.MetricAlarms ?? []) as Array<{
      AlarmName?: string | null;
      StateValue?: string | null;
      StateReason?: string | null;
    }>;
    const alarms = rawAlarms.map((a) => ({
      name: a.AlarmName ?? "",
      state: a.StateValue ?? "",
      reason: a.StateReason ?? "",
    }));

    return respondOk(ctx, { budgets, alarms });
  } catch (err) {
    logError("admin.infra.alerts_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const GET = withApiEnvelope(_GET);
