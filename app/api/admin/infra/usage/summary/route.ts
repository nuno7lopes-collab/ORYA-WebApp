import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { logError } from "@/lib/observability/logger";
import {
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
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

    const notes: string[] = [];

    const ecsClient = new ECSClient(getAwsConfig());
    const elbClient = new ElasticLoadBalancingV2Client(getAwsConfig());

    const clustersRes = await ecsClient.send(new ListClustersCommand({}));
    const clusterArns: string[] = clustersRes.clusterArns ?? [];
    const clusters = clusterArns.map((arn) => ({
      name: arn.split("/").pop() ?? arn,
      status: "UNKNOWN",
    }));

    const services: Array<{ name: string; status: string; desired: number; running: number }> = [];
    if (clusterArns.length > 0) {
      const cluster = clusterArns[0];
      const listServices = await ecsClient.send(new ListServicesCommand({ cluster }));
      const serviceArns: string[] = listServices.serviceArns ?? [];
      if (serviceArns.length > 0) {
        const describe = await ecsClient.send(
          new DescribeServicesCommand({ cluster, services: serviceArns.slice(0, 10) }),
        );
        const describedServices = (describe.services ?? []) as Array<{
          serviceName?: string | null;
          status?: string | null;
          desiredCount?: number | null;
          runningCount?: number | null;
        }>;
        for (const svc of describedServices) {
          services.push({
            name: svc.serviceName ?? "",
            status: svc.status ?? "",
            desired: svc.desiredCount ?? 0,
            running: svc.runningCount ?? 0,
          });
        }
      } else {
        notes.push("Sem services ECS detectados.");
      }
    } else {
      notes.push("Sem clusters ECS detectados.");
    }

    const lbRes = await elbClient.send(new DescribeLoadBalancersCommand({}));
    const rawLoadBalancers = (lbRes.LoadBalancers ?? []) as Array<{
      LoadBalancerName?: string | null;
      DNSName?: string | null;
      Scheme?: string | null;
    }>;
    const loadBalancers = rawLoadBalancers.map((lb) => ({
      name: lb.LoadBalancerName ?? "",
      dns: lb.DNSName ?? "",
      scheme: lb.Scheme ?? "",
    }));

    return respondOk(ctx, { clusters, services, loadBalancers, notes });
  } catch (err) {
    logError("admin.infra.usage_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const GET = withApiEnvelope(_GET);
