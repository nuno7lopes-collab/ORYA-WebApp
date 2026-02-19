import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { ECSClient, DescribeServicesCommand } from "@aws-sdk/client-ecs";
import { getAwsConfig } from "@/lib/awsSdk";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

const execFileAsync = promisify(execFile);

type RedisStatus = {
  configured: boolean;
  cacheName: string | null;
  status: string | null;
  endpoint: string | null;
  source: "secretsmanager" | "secret-missing" | "error";
};

function parseRedisCacheName(redisUrl: string | null) {
  if (!redisUrl) return null;
  try {
    const url = new URL(redisUrl);
    const host = url.hostname;
    if (!host) return null;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
}

async function runAwsCli(args: string[]) {
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-west-1";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    AWS_REGION: region,
    AWS_DEFAULT_REGION: region,
  };
  const { stdout } = await execFileAsync("aws", args, {
    env,
    timeout: 20_000,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function resolveRedisStatus(secretId: string): Promise<RedisStatus> {
  try {
    const secretRaw = await runAwsCli([
      "secretsmanager",
      "get-secret-value",
      "--secret-id",
      secretId,
      "--query",
      "SecretString",
      "--output",
      "text",
    ]);
    if (!secretRaw) {
      return {
        configured: false,
        cacheName: null,
        status: null,
        endpoint: null,
        source: "secret-missing",
      };
    }

    const secret = JSON.parse(secretRaw) as { REDIS_URL?: string };
    const redisUrl = secret.REDIS_URL?.trim() || "";
    if (!redisUrl) {
      return {
        configured: false,
        cacheName: null,
        status: null,
        endpoint: null,
        source: "secretsmanager",
      };
    }

    const cacheName = parseRedisCacheName(redisUrl);
    if (!cacheName) {
      return {
        configured: true,
        cacheName: null,
        status: null,
        endpoint: null,
        source: "secretsmanager",
      };
    }

    try {
      const cacheRaw = await runAwsCli([
        "elasticache",
        "describe-serverless-caches",
        "--serverless-cache-name",
        cacheName,
        "--query",
        "ServerlessCaches[0].{status:Status,endpoint:Endpoint.Address}",
        "--output",
        "json",
      ]);
      const cache = cacheRaw ? (JSON.parse(cacheRaw) as { status?: string; endpoint?: string } | null) : null;
      return {
        configured: true,
        cacheName,
        status: cache?.status ?? null,
        endpoint: cache?.endpoint ?? null,
        source: "secretsmanager",
      };
    } catch {
      return {
        configured: true,
        cacheName,
        status: "not-found",
        endpoint: null,
        source: "secretsmanager",
      };
    }
  } catch {
    return {
      configured: false,
      cacheName: null,
      status: null,
      endpoint: null,
      source: "error",
    };
  }
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const stackName = process.env.ORYA_CF_STACK ?? "orya-prod";
    const redisSecretId = process.env.REDIS_SECRET_ID ?? "orya/prod/app";
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

    const redis = await resolveRedisStatus(redisSecretId);

    return respondOk(ctx, {
      stackName,
      status: stack.StackStatus,
      updatedAt: stack.LastUpdatedTime ?? stack.CreationTime,
      outputs,
      services,
      redis,
    });
  } catch (err) {
    logError("admin.infra.status_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const GET = withApiEnvelope(_GET);
