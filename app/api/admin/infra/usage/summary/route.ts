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

    const notes: string[] = [];

    const clustersRes = await runAwsCli(ctx, ["ecs", "list-clusters"]);
    if (!clustersRes.ok) {
      return fail(ctx, 500, "ECS_LIST_FAILED", clustersRes.error ?? "ECS_LIST_FAILED");
    }

    const clusterArns: string[] = clustersRes.data?.clusterArns ?? [];
    const clusters = clusterArns.map((arn) => ({
      name: arn.split("/").pop() ?? arn,
      status: "UNKNOWN",
    }));

    const services: Array<{ name: string; status: string; desired: number; running: number }> = [];
    if (clusterArns.length > 0) {
      const cluster = clusterArns[0];
      const listServices = await runAwsCli(ctx, ["ecs", "list-services", "--cluster", cluster]);
      if (listServices.ok) {
        const serviceArns: string[] = listServices.data?.serviceArns ?? [];
        if (serviceArns.length > 0) {
          const describe = await runAwsCli(ctx, [
            "ecs",
            "describe-services",
            "--cluster",
            cluster,
            "--services",
            ...serviceArns.slice(0, 10),
          ]);
          if (describe.ok) {
            for (const svc of describe.data?.services ?? []) {
              services.push({
                name: svc.serviceName,
                status: svc.status,
                desired: svc.desiredCount ?? 0,
                running: svc.runningCount ?? 0,
              });
            }
          }
        } else {
          notes.push("Sem services ECS detectados.");
        }
      } else {
        notes.push("Falha ao listar services ECS.");
      }
    } else {
      notes.push("Sem clusters ECS detectados.");
    }

    const lbRes = await runAwsCli(ctx, ["elbv2", "describe-load-balancers"]);
    const loadBalancers =
      lbRes.ok
        ? (lbRes.data?.LoadBalancers ?? []).map((lb: any) => ({
            name: lb.LoadBalancerName,
            dns: lb.DNSName,
            scheme: lb.Scheme,
          }))
        : [];
    if (!lbRes.ok) notes.push("Falha ao listar ALBs.");

    return respondOk(ctx, { clusters, services, loadBalancers, notes });
  } catch (err) {
    logError("admin.infra.usage_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
