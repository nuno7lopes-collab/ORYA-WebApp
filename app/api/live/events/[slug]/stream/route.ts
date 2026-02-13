export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";
import { buildPadelLivePayload } from "@/domain/live/padelLivePayload";

const REFRESH_MS = 15000;

type Params = { slug: string };

async function _GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

  const resolved = await params;
  const slug = resolved?.slug?.trim();
  if (!slug) {
    return jsonWrap({ ok: false, error: "INVALID_SLUG" }, { status: 400 });
  }

  const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));

  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "live_event_stream",
    identifier: slug,
    max: 30,
  });
  if (rateLimited) return rateLimited;

  const event = await prisma.event.findUnique({
    where: { slug, isDeleted: false },
    select: { id: true },
  });
  if (!event) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const initialPayload = await buildPadelLivePayload(event.id, Number.isFinite(categoryId) ? categoryId : null);
  if ("error" in initialPayload) {
    const status = initialPayload.error === "EVENT_NOT_FOUND" ? 404 : initialPayload.error === "FORBIDDEN" ? 403 : 400;
    return jsonWrap({ ok: false, error: initialPayload.error }, { status });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const pushPayload = (payload: typeof initialPayload) => {
        controller.enqueue(
          encoder.encode(`event: update\ndata: ${JSON.stringify({ ...payload, updatedAt: new Date().toISOString() })}\n\n`),
        );
      };

      const send = async () => {
        if (closed) return;
        try {
          const payload = await buildPadelLivePayload(event.id, Number.isFinite(categoryId) ? categoryId : null);
          if ("error" in payload) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(payload)}\n\n`));
            return;
          }
          pushPayload(payload);
        } catch {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "STREAM_ERROR" })}\n\n`));
        }
      };

      pushPayload(initialPayload);
      const interval = setInterval(send, REFRESH_MS);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        controller.close();
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export const GET = withApiEnvelope(_GET);
