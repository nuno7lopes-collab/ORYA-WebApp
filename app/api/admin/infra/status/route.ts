import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
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

    const stackName = process.env.ORYA_CF_STACK ?? "orya-prod";
    const stackRes = await runAwsCli(ctx, ["cloudformation", "describe-stacks", "--stack-name", stackName]);
    if (!stackRes.ok) {
      return fail(ctx, 500, "INFRA_STATUS_FAILED", stackRes.error ?? "INFRA_STATUS_FAILED");
    }

    const stack = (stackRes.data?.Stacks ?? [])[0] ?? null;
    if (!stack) return fail(ctx, 404, "STACK_NOT_FOUND");

    const outputs = Object.fromEntries(
      (stack.Outputs ?? []).map((entry: { OutputKey?: string; OutputValue?: string }) => [entry.OutputKey, entry.OutputValue]),
    );

    let services: Array<Record<string, unknown>> = [];
    if (outputs.ClusterName && outputs.WebServiceName) {
      const serviceRes = await runAwsCli(ctx, [
        "ecs",
        "describe-services",
        "--cluster",
        String(outputs.ClusterName),
        "--services",
        String(outputs.WebServiceName),
        String(outputs.WorkerServiceName ?? ""),
      ]);
      if (serviceRes.ok) {
        services = (serviceRes.data?.services ?? []).map((svc: any) => ({
          serviceName: svc.serviceName,
          status: svc.status,
          desiredCount: svc.desiredCount,
          runningCount: svc.runningCount,
          pendingCount: svc.pendingCount,
          launchType: svc.launchType,
        }));
      }
    }

    return respondOk(ctx, {
      stackName,
      status: stack.StackStatus,
      updatedAt: stack.LastUpdatedTime ?? stack.CreationTime,
      outputs,
      services,
    });
  } catch (err) {
    logError("admin.infra.status_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
