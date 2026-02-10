export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return respondError(
      ctx,
      { errorCode: "SERVICO_INVALIDO", message: "Serviço indisponível.", retryable: false },
      { status: 400 },
    );
  }

  return respondError(
    ctx,
    { errorCode: "CREDITS_DISABLED", message: "Créditos indisponíveis.", retryable: false },
    { status: 410 },
  );
}

export const POST = withApiEnvelope(_POST);
