import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { ECSClient, DescribeServicesCommand } from "@aws-sdk/client-ecs";
import { getAwsConfig } from "@/lib/awsSdk";

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
    const cfClient = new CloudFormationClient(getAwsConfig());
    const ecsClient = new ECSClient(getAwsConfig());

    const stackRes = await cfClient.send(new DescribeStacksCommand({ StackName: stackName }));
    const stack = (stackRes.Stacks ?? [])[0] ?? null;
    if (!stack) return fail(ctx, 404, "STACK_NOT_FOUND");

    const outputs = Object.fromEntries(
      (stack.Outputs ?? []).map((entry: { OutputKey?: string; OutputValue?: string }) => [entry.OutputKey, entry.OutputValue]),
    );

    let services: Array<Record<string, unknown>> = [];
    if (outputs.ClusterName && outputs.WebServiceName) {
      const serviceNames = [String(outputs.WebServiceName)];
      if (outputs.WorkerServiceName) serviceNames.push(String(outputs.WorkerServiceName));

      const serviceRes = await ecsClient.send(
        new DescribeServicesCommand({
          cluster: String(outputs.ClusterName),
          services: serviceNames,
        }),
      );
      services = (serviceRes.services ?? []).map((svc: {
        serviceName?: string | null;
        status?: string | null;
        desiredCount?: number | null;
        runningCount?: number | null;
        pendingCount?: number | null;
        launchType?: string | null;
      }) => ({
        serviceName: svc.serviceName,
        status: svc.status,
        desiredCount: svc.desiredCount,
        runningCount: svc.runningCount,
        pendingCount: svc.pendingCount,
        launchType: svc.launchType,
      }));
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
