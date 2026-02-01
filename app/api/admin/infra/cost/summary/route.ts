import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { logError } from "@/lib/observability/logger";
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { BudgetsClient, DescribeBudgetsCommand } from "@aws-sdk/client-budgets";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { getAwsConfig } from "@/lib/awsSdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getAccountId() {
  const sts = new STSClient(getAwsConfig());
  const identity = await sts.send(new GetCallerIdentityCommand({}));
  if (!identity.Account) throw new Error("ACCOUNT_ID_MISSING");
  return String(identity.Account);
}

async function fetchBudgetFallback() {
  const accountId = await getAccountId();
  const budgetsClient = new BudgetsClient({ ...getAwsConfig(), region: "us-east-1" });
  const budgetsRes = await budgetsClient.send(new DescribeBudgetsCommand({ AccountId: accountId }));
  const budgets = budgetsRes.Budgets ?? [];
  const target = budgets.find((b) => b.BudgetName === "ORYA-BUDGET-MONTHLY-75USD") ?? budgets[0];
  const currency = target?.BudgetLimit?.Unit ?? "USD";
  const total = Number(target?.CalculatedSpend?.ActualSpend?.Amount ?? 0);
  return {
    source: "budgets",
    currency,
    total,
    byService: [],
    daily: [],
    note: "Cost Explorer indisponível; fallback para Budget.",
  };
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

    try {
      const client = new CostExplorerClient({ ...getAwsConfig(), region: "us-east-1" });
      const resp = await client.send(
        new GetCostAndUsageCommand({
          TimePeriod: { Start: formatDate(start), End: formatDate(end) },
          Granularity: "DAILY",
          Metrics: ["UnblendedCost"],
          GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
        }),
      );

      const results = resp.ResultsByTime ?? [];
      const currency = results?.[0]?.Total?.UnblendedCost?.Unit ?? "USD";
      const daily = results.map((day: any) => ({
        date: day.TimePeriod?.Start ?? "",
        amount: Number(day.Total?.UnblendedCost?.Amount ?? 0),
      }));
      const byServiceMap = new Map<string, number>();
      for (const day of results) {
        for (const group of day.Groups ?? []) {
          const service = group.Keys?.[0] ?? "Unknown";
          const amount = Number(group.Metrics?.UnblendedCost?.Amount ?? 0);
          byServiceMap.set(service, (byServiceMap.get(service) ?? 0) + amount);
        }
      }
      const byService = Array.from(byServiceMap.entries())
        .map(([service, amount]) => ({ service, amount }))
        .sort((a, b) => b.amount - a.amount);

      const total = byService.reduce((sum, row) => sum + row.amount, 0);

      return respondOk(ctx, { source: "cost-explorer", currency, total, byService, daily });
    } catch (ceErr) {
      const fallback = await fetchBudgetFallback();
      return respondOk(ctx, fallback);
    }
  } catch (err) {
    logError("admin.infra.cost_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
