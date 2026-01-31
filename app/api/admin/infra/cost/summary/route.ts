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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

    const costRes = await runAwsCli(ctx, [
      "ce",
      "get-cost-and-usage",
      "--time-period",
      `Start=${formatDate(start)},End=${formatDate(end)}`,
      "--granularity",
      "DAILY",
      "--metrics",
      "UnblendedCost",
      "--group-by",
      "Type=DIMENSION,Key=SERVICE",
    ]);

    if (!costRes.ok) {
      return fail(ctx, 500, "COST_EXPLORER_FAILED", costRes.error ?? "COST_EXPLORER_FAILED");
    }

    const results = costRes.data?.ResultsByTime ?? [];
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

    return respondOk(ctx, { currency, total, byService, daily });
  } catch (err) {
    logError("admin.infra.cost_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
