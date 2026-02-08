import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { logError } from "@/lib/observability/logger";
import { BudgetsClient, DescribeBudgetsCommand } from "@aws-sdk/client-budgets";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { getAwsConfig } from "@/lib/awsSdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CostPayload = {
  source: "budgets";
  currency: string;
  total: number;
  byService: Array<{ service: string; amount: number }>;
  daily: Array<{ date: string; amount: number }>;
  note?: string;
  cached?: boolean;
  cacheAgeSeconds?: number;
};

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

const CACHE_TTL_SECONDS = Number(process.env.INFRA_COST_CACHE_TTL_SECONDS ?? 10800);
const REFRESH_COOLDOWN_SECONDS = Number(process.env.INFRA_COST_REFRESH_COOLDOWN_SECONDS ?? 60);
let costCache: { data: CostPayload; fetchedAt: number } | null = null;
let lastRefreshAt = 0;

async function getAccountId() {
  const sts = new STSClient(getAwsConfig());
  const identity = await sts.send(new GetCallerIdentityCommand({}));
  if (!identity.Account) throw new Error("ACCOUNT_ID_MISSING");
  return String(identity.Account);
}

async function fetchBudgetSummary() {
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
    note: "Budgets não fornece breakdown por serviço ou diário.",
    cached: false,
  } satisfies CostPayload;
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const now = Date.now();
    const refresh = req.nextUrl.searchParams.get("refresh") === "1";
    if (refresh) {
      if (now - lastRefreshAt < REFRESH_COOLDOWN_SECONDS * 1000) {
        return fail(ctx, 429, "RATE_LIMIT", "Aguarda antes de atualizar novamente.");
      }
      lastRefreshAt = now;
    } else if (costCache && now - costCache.fetchedAt < CACHE_TTL_SECONDS * 1000) {
      const cachedAge = Math.max(0, Math.round((now - costCache.fetchedAt) / 1000));
      return respondOk(ctx, { ...costCache.data, cached: true, cacheAgeSeconds: cachedAge });
    }

    const payload = await fetchBudgetSummary();
    costCache = { data: payload, fetchedAt: now };
    return respondOk(ctx, payload);
  } catch (err) {
    logError("admin.infra.cost_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
